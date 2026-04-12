/**
 * ModelDownloader — resumable on-device model download.
 *
 * Responsibilities:
 *   - Download the Gemma model from MODEL_CDN_URL into the app documents dir
 *   - Resume partial downloads that survived an app close / crash
 *   - Verify SHA-256 checksum after download completes
 *   - Persist the downloaded model path and version in AsyncStorage
 *   - Expose a typed progress callback: { received, total, percent, etaSeconds }
 *
 * The model URL is:  ${MODEL_CDN_URL}/gemma-4-E2B-it.litertlm
 * The checksum URL is: ${MODEL_CDN_URL}/gemma-4-E2B-it.litertlm.sha256
 *   (HuggingFace does not serve .sha256 sidecar files; checksum is skipped in
 *   dev when the endpoint returns 4xx/network error — see verifyChecksum.)
 *
 * Usage:
 *   const dl = new ModelDownloader(onProgress);
 *   const path = await dl.ensureModel();   // resolves when ready
 *   dl.cancel();                           // abort in-flight download
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFetchBlob from 'rn-fetch-blob';
import type {StatefulPromise, FetchBlobResponse} from 'rn-fetch-blob';
import {AppConfig} from '@/config/env';
import {logger} from '@/utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DownloadProgress = {
  received: number; // bytes received so far
  total: number; // total bytes (-1 if unknown)
  percent: number; // 0–100
  etaSeconds: number; // estimated seconds remaining (-1 if unknown)
};

export type ModelInfo = {
  path: string;
  version: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// Gemma 4 E2B instruction-tuned, LiteRT format (~2.58 GB).
// Public mirror — no HuggingFace account required.
// MediaPipe LLM Inference (tasks-genai) loads .litertlm files directly via setModelPath.
const MODEL_URL = 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm';
const MODEL_FILENAME = 'gemma-4-E2B-it.litertlm';
const MODEL_VERSION = 'gemma-4-e2b-it';
const STORAGE_KEY_MODEL_PATH = '@olix/model_path';
const STORAGE_KEY_MODEL_VERSION = '@olix/model_version';

// ─── ModelDownloader ──────────────────────────────────────────────────────────

export class ModelDownloader {
  private readonly onProgress: (p: DownloadProgress) => void;
  private task: StatefulPromise<FetchBlobResponse> | null = null;
  private cancelled = false;
  private startTime = 0;

  constructor(onProgress: (p: DownloadProgress) => void) {
    this.onProgress = onProgress;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Returns the local path to a ready model, downloading if necessary.
   * Safe to call on every app launch — returns immediately if already cached.
   */
  async ensureModel(): Promise<string> {
    const cached = await this.getCachedModelInfo();
    if (cached) {
      const exists = await RNFetchBlob.fs.exists(cached.path);
      if (exists) {
        logger.debug('ModelDownloader: using cached model', {path: cached.path});
        return cached.path;
      }
      logger.debug('ModelDownloader: cached path missing, re-downloading');
    }
    return this.download();
  }

  /** Abort any in-flight download. The partial file is kept for resume. */
  cancel(): void {
    this.cancelled = true;
    void this.task?.cancel();
  }

  // ── Cached model info ───────────────────────────────────────────────────────

  static async getStoredModelInfo(): Promise<ModelInfo | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pairs = await (AsyncStorage as any).multiGet([STORAGE_KEY_MODEL_PATH, STORAGE_KEY_MODEL_VERSION]) as [string, string | null][];
    const pathVal = pairs.find(([k]: [string, string | null]) => k === STORAGE_KEY_MODEL_PATH)?.[1];
    const versionVal = pairs.find(([k]: [string, string | null]) => k === STORAGE_KEY_MODEL_VERSION)?.[1];
    if (pathVal && versionVal) {
      return {path: pathVal, version: versionVal};
    }
    return null;
  }

  static async clearStoredModelInfo(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (AsyncStorage as any).multiRemove([STORAGE_KEY_MODEL_PATH, STORAGE_KEY_MODEL_VERSION]);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async getCachedModelInfo(): Promise<ModelInfo | null> {
    return ModelDownloader.getStoredModelInfo();
  }

  private async download(): Promise<string> {
    this.cancelled = false;
    this.startTime = Date.now();

    const destDir = RNFetchBlob.fs.dirs.DocumentDir;
    const destPath = `${destDir}/${MODEL_FILENAME}`;
    const modelUrl = MODEL_URL;

    logger.debug('ModelDownloader: starting download', {url: modelUrl, dest: destPath});

    // Preflight (GET Range: bytes=0-0) — catches auth/URL errors before the large
    // download starts instead of letting rn-fetch-blob throw "Download interrupted."
    await this.preflight(modelUrl);

    // Check if a partial file exists for resume
    const partialExists = await RNFetchBlob.fs.exists(destPath);
    let resumeOffset = 0;
    if (partialExists) {
      const stat = await RNFetchBlob.fs.stat(destPath);
      resumeOffset = stat.size;
      logger.debug('ModelDownloader: resuming', {offset: resumeOffset});
    }

    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache',
    };
    if (resumeOffset > 0) {
      headers.Range = `bytes=${resumeOffset}-`;
    }

    return new Promise<string>((resolve, reject) => {
      this.task = RNFetchBlob.config({
        path: destPath,
        appendExt: '',
        overwrite: resumeOffset === 0,
        IOSBackgroundTask: true,
      })
        .fetch('GET', modelUrl, headers)
        .progress({count: 10}, (received: number, total: number) => {
          if (this.cancelled) {
            return;
          }
          const progress = this.buildProgress(received + resumeOffset, total + resumeOffset);
          this.onProgress(progress);
        });

      void this.task
        .then(async (res: FetchBlobResponse) => {
          if (this.cancelled) {
            reject(new Error('Download cancelled'));
            return;
          }

          const {status} = res.respInfo;
          if (status !== 200 && status !== 206) {
            reject(new Error(`Download failed with HTTP ${status}`));
            return;
          }

          const filePath = res.path();

          try {
            await this.verifyChecksum(filePath, modelUrl);
          } catch (err) {
            await RNFetchBlob.fs.unlink(filePath).catch(() => {});
            reject(err instanceof Error ? err : new Error(String(err)));
            return;
          }

          const version = await this.fetchVersion();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (AsyncStorage as any).multiSet([
            [STORAGE_KEY_MODEL_PATH, filePath],
            [STORAGE_KEY_MODEL_VERSION, version],
          ]);

          logger.debug('ModelDownloader: complete', {path: filePath, version});
          resolve(filePath);
        })
        .catch((err: unknown) => {
          if (this.cancelled) {
            reject(new Error('Download cancelled'));
          } else {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
    });
  }

  private buildProgress(received: number, total: number): DownloadProgress {
    const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
    const elapsedMs = Date.now() - this.startTime;
    let etaSeconds = -1;
    if (percent > 0 && percent < 100 && elapsedMs > 0) {
      const msPerPercent = elapsedMs / percent;
      etaSeconds = Math.round((msPerPercent * (100 - percent)) / 1000);
    }
    return {received, total, percent, etaSeconds};
  }

  /**
   * Preflight GET (Range: bytes=0-0) before the large download begins.
   * rn-fetch-blob doesn't support HEAD, so we fetch exactly 1 byte.
   * Surfaces auth errors (401/403) and bad URLs immediately with a clear message
   * instead of letting rn-fetch-blob throw a cryptic "Download interrupted."
   */
  private async preflight(modelUrl: string): Promise<void> {
    let status: number;
    try {
      const res = await RNFetchBlob.fetch('GET', modelUrl, {
        'User-Agent': 'OlixApp/1.0',
        Range: 'bytes=0-0',
      });
      status = res.respInfo.status;
    } catch (err) {
      // Network-level failure — pass through, the main download will fail with its own message
      logger.warn('ModelDownloader: preflight failed (network)', err);
      return;
    }

    logger.debug('ModelDownloader: preflight status', {status, url: modelUrl});

    if (status === 401 || status === 403) {
      throw new Error(
        'Model download requires a HuggingFace account with the Gemma license accepted. ' +
          'Visit huggingface.co/google/gemma and accept the license, then retry.',
      );
    }
    if (status === 404) {
      throw new Error(`Model not found at the configured URL (HTTP 404). Check MODEL_CDN_URL.`);
    }
    if (status >= 400) {
      throw new Error(`Model URL returned HTTP ${status}. Check your internet connection and retry.`);
    }
    // 200, 206 (partial content), or 302 (redirect followed by rn-fetch-blob) — proceed
  }

  private async verifyChecksum(filePath: string, modelUrl: string): Promise<void> {
    const checksumUrl = `${modelUrl}.sha256`;
    logger.debug('ModelDownloader: verifying checksum', {checksumUrl});

    let expected: string;
    try {
      const res = await RNFetchBlob.fetch('GET', checksumUrl);
      const rawText = res.text() as string | Promise<string>;
      const text = typeof rawText === 'string' ? rawText : await rawText;
      expected = text.trim().split(/\s+/)[0] ?? '';
    } catch {
      if (AppConfig.isDev) {
        logger.debug('ModelDownloader: skipping checksum in dev (endpoint unavailable)');
        return;
      }
      throw new Error('Failed to fetch model checksum');
    }

    if (!expected) {
      if (AppConfig.isDev) {
        return;
      }
      throw new Error('Empty checksum returned from server');
    }

    const actual = await RNFetchBlob.fs.hash(filePath, 'sha256');
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`Checksum mismatch — expected ${expected}, got ${actual}`);
    }
    logger.debug('ModelDownloader: checksum OK');
  }

  private async fetchVersion(): Promise<string> {
    // HuggingFace does not serve a version.txt sidecar. Return the compile-time
    // constant that identifies exactly which model file was downloaded.
    return MODEL_VERSION;
  }
}
