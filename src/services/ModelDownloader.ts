/**
 * ModelDownloader — resumable on-device model download via native OkHttp.
 *
 * Responsibilities:
 *   - Download the Gemma model via the OlixDownloadModule native module
 *   - Resume partial downloads that survived an app close / crash
 *   - Persist the downloaded model path and version in AsyncStorage
 *   - Expose a typed progress callback: { received, total, percent, etaSeconds }
 *
 * Why native (OlixDownloadModule) instead of JS fetch():
 *   OkHttp streams directly from the network to FileOutputStream with no JS
 *   thread involvement, no base64 round-trip, and no GC pressure from large
 *   ArrayBuffers. This is ~10-20x faster than the previous JS chunked approach
 *   and handles HuggingFace's XET cross-domain redirects correctly.
 *
 * Usage:
 *   const dl = new ModelDownloader(onProgress);
 *   const path = await dl.ensureModel();   // resolves when ready
 *   dl.cancel();                           // abort in-flight download
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter, NativeModules} from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';
import {logger} from '@/utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DownloadProgress = {
  received: number; // bytes received so far
  total: number;    // total bytes (-1 if unknown)
  percent: number;  // 0–100
  etaSeconds: number; // estimated seconds remaining (-1 if unknown)
};

export type ModelInfo = {
  path: string;
  version: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm';
const MODEL_FILENAME = 'gemma-4-E4B-it.litertlm';
const MODEL_VERSION = 'gemma-4-e4b-it';
const STORAGE_KEY_MODEL_PATH = '@olix/model_path';
const STORAGE_KEY_MODEL_VERSION = '@olix/model_version';

const {OlixDownload} = NativeModules as {
  OlixDownload: {
    downloadModel(url: string, destPath: string): Promise<string>;
    cancelDownload(): Promise<void>;
  };
};

// ─── ModelDownloader ──────────────────────────────────────────────────────────

export class ModelDownloader {
  private readonly onProgress: (p: DownloadProgress) => void;
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
    if (cached && cached.version === MODEL_VERSION) {
      const exists = await RNFetchBlob.fs.exists(cached.path);
      if (exists) {
        logger.debug('ModelDownloader: using cached model', {path: cached.path});
        return cached.path;
      }
      logger.debug('ModelDownloader: cached path missing, re-downloading');
    } else if (cached && cached.version !== MODEL_VERSION) {
      logger.debug('ModelDownloader: model version mismatch, re-downloading', {
        cached: cached.version,
        required: MODEL_VERSION,
      });
    }
    return this.download();
  }

  /** Abort any in-flight download. The partial file is kept for resume. */
  cancel(): void {
    this.cancelled = true;
    OlixDownload.cancelDownload().catch(() => {});
  }

  // ── Cached model info ───────────────────────────────────────────────────────

  static async getStoredModelInfo(): Promise<ModelInfo | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pairs = await (AsyncStorage as any).multiGet([
      STORAGE_KEY_MODEL_PATH,
      STORAGE_KEY_MODEL_VERSION,
    ]) as [string, string | null][];
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

    const destPath = `${RNFetchBlob.fs.dirs.DocumentDir}/${MODEL_FILENAME}`;
    logger.debug('ModelDownloader: starting download', {dest: destPath, url: MODEL_URL});

    // Subscribe to native progress events before starting the download.
    const progressSub = DeviceEventEmitter.addListener(
      'OlixDownloadProgress',
      (data: {percent: number; received: number; total: number}) => {
        this.onProgress(this.buildProgress(data.received, data.total));
      },
    );

    try {
      const resultPath = await OlixDownload.downloadModel(MODEL_URL, destPath);

      if (this.cancelled) {
        throw new Error('Download cancelled');
      }

      logger.debug('ModelDownloader: download complete', {path: resultPath});

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (AsyncStorage as any).multiSet([
        [STORAGE_KEY_MODEL_PATH, resultPath],
        [STORAGE_KEY_MODEL_VERSION, MODEL_VERSION],
      ]);

      return resultPath;
    } finally {
      progressSub.remove();
    }
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
}
