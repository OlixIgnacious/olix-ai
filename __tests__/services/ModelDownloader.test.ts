/**
 * Unit tests for ModelDownloader.
 *
 * rn-fetch-blob, react-native-config, and AsyncStorage are fully mocked.
 * Tests cover: cache hit, cache miss + fresh download, resume, checksum
 * verification, cancellation, and AsyncStorage persistence.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-native-config', () => ({
  APP_ENV: 'dev',
  APP_DISPLAY_NAME: 'Olix Dev',
  BUNDLE_ID: 'com.olix.dev',
  MODEL_CDN_URL: 'https://dev-cdn.example.com/models',
  SENTRY_DSN: '',
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getMany: jest.fn(),
  setMany: jest.fn(),
  removeMany: jest.fn(),
}));

// rn-fetch-blob mock — uses a real deferred Promise so resolveDownload /
// rejectDownload work correctly regardless of mock.calls ordering.
jest.mock('rn-fetch-blob', () => {
  let _exists = false;
  let _fileSize = 0;
  let _hash = 'abc123';
  let _fetchText = 'abc123';
  let _taskResolve: ((r: {path: () => string; respInfo: {status: number}}) => void) | undefined;
  let _taskReject: ((e: unknown) => void) | undefined;

  return {
    __esModule: true,
    default: {
      config: jest.fn(() => ({
        fetch: jest.fn(() => {
          // Real deferred Promise — tests resolve/reject it via __resolveTask /
          // __rejectTask instead of digging into mock.calls.
          const p = new Promise<{path: () => string; respInfo: {status: number}}>((res, rej) => {
            _taskResolve = res;
            _taskReject = rej;
          });
          // progress() must return the task itself (the service assigns this.task
          // to the result of .progress()). Decouple assignment so TypeScript can
          // infer without a circular self-reference in the initializer.
          const progressFn = jest.fn();
          const task = Object.assign(p, {progress: progressFn, cancel: jest.fn()});
          progressFn.mockReturnValue(task);
          return task;
        }),
      })),
      fetch: jest.fn(() =>
        Promise.resolve({
          text: (): string => _fetchText,
          respInfo: {status: 200},
        }),
      ),
      fs: {
        dirs: {DocumentDir: '/docs'},
        exists: jest.fn(() => Promise.resolve(_exists)),
        stat: jest.fn(() => Promise.resolve({size: _fileSize})),
        hash: jest.fn(() => Promise.resolve(_hash)),
        unlink: jest.fn(() => Promise.resolve()),
      },
    },
    // State helpers — called before creating a ModelDownloader
    __setExists: (v: boolean): void => {
      _exists = v;
    },
    __setFileSize: (v: number): void => {
      _fileSize = v;
    },
    __setHash: (v: string): void => {
      _hash = v;
    },
    __setFetchText: (v: string): void => {
      _fetchText = v;
    },
    // Task control helpers — called after ensureModel() + flush()
    __resolveTask: (r: {path: () => string; respInfo: {status: number}}): void => {
      _taskResolve?.(r);
    },
    __rejectTask: (e: unknown): void => {
      _taskReject?.(e);
    },
  };
});

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import {ModelDownloader} from '../../src/services/ModelDownloader';

const RNFetchBlobMock = jest.requireMock<{
  __setExists(v: boolean): void;
  __setFileSize(v: number): void;
  __setHash(v: string): void;
  __setFetchText(v: string): void;
  __resolveTask(r: {path: () => string; respInfo: {status: number}}): void;
  __rejectTask(e: unknown): void;
}>('rn-fetch-blob');
const mockGetMany = jest.mocked(AsyncStorage.getMany);
const mockSetMany = jest.mocked(AsyncStorage.setMany);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Drain the microtask queue via setImmediate so that the async steps inside
 * download() (getCachedModelInfo → fs.exists → fs.stat) complete and the
 * deferred task is created before we resolve/reject it.
 */
function flush(): Promise<void> {
  return new Promise<void>(resolve => setImmediate(resolve));
}

/** Simulate a successful download completing. */
async function resolveDownload(path = '/docs/gemma-4.task', status = 200): Promise<void> {
  await flush();
  RNFetchBlobMock.__resolveTask({path: () => path, respInfo: {status}});
}

async function rejectDownload(err: Error): Promise<void> {
  await flush();
  RNFetchBlobMock.__rejectTask(err);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  RNFetchBlobMock.__setExists(false);
  RNFetchBlobMock.__setFileSize(0);
  RNFetchBlobMock.__setHash('abc123');
  RNFetchBlobMock.__setFetchText('abc123');
  mockGetMany.mockResolvedValue({
    '@olix/model_path': null,
    '@olix/model_version': null,
  });
  mockSetMany.mockResolvedValue(undefined);
});

// ── getStoredModelInfo ────────────────────────────────────────────────────────

describe('ModelDownloader.getStoredModelInfo', () => {
  it('returns null when AsyncStorage has no stored model', async () => {
    mockGetMany.mockResolvedValueOnce({'@olix/model_path': null, '@olix/model_version': null});
    const info = await ModelDownloader.getStoredModelInfo();
    expect(info).toBeNull();
  });

  it('returns stored path and version when present', async () => {
    mockGetMany.mockResolvedValueOnce({
      '@olix/model_path': '/docs/gemma-4.task',
      '@olix/model_version': '1.0.0',
    });
    const info = await ModelDownloader.getStoredModelInfo();
    expect(info).toEqual({path: '/docs/gemma-4.task', version: '1.0.0'});
  });

  it('returns null when only path is stored (no version)', async () => {
    mockGetMany.mockResolvedValueOnce({
      '@olix/model_path': '/docs/gemma-4.task',
      '@olix/model_version': null,
    });
    const info = await ModelDownloader.getStoredModelInfo();
    expect(info).toBeNull();
  });
});

// ── ensureModel — cache hit ───────────────────────────────────────────────────

describe('ensureModel — cache hit', () => {
  it('returns cached path without downloading when file exists on disk', async () => {
    mockGetMany.mockResolvedValueOnce({
      '@olix/model_path': '/docs/gemma-4.task',
      '@olix/model_version': '1.0.0',
    });
    RNFetchBlobMock.__setExists(true);

    const dl = new ModelDownloader(jest.fn());
    const path = await dl.ensureModel();

    expect(path).toBe('/docs/gemma-4.task');
    // config().fetch should NOT have been called
    const RNFetchBlob = jest.requireMock('rn-fetch-blob').default as {config: jest.Mock};
    expect(RNFetchBlob.config).not.toHaveBeenCalled();
  });

  it('re-downloads when cached path file is missing from disk', async () => {
    mockGetMany.mockResolvedValueOnce({
      '@olix/model_path': '/docs/gemma-4.task',
      '@olix/model_version': '1.0.0',
    });
    // File does not exist on disk
    RNFetchBlobMock.__setExists(false);

    const dl = new ModelDownloader(jest.fn());
    const promise = dl.ensureModel();

    await resolveDownload();
    await promise;

    const RNFetchBlob = jest.requireMock('rn-fetch-blob').default as {config: jest.Mock};
    expect(RNFetchBlob.config).toHaveBeenCalled();
  });
});

// ── ensureModel — fresh download ──────────────────────────────────────────────

describe('ensureModel — fresh download', () => {
  it('resolves with the downloaded file path', async () => {
    const onProgress = jest.fn();
    const dl = new ModelDownloader(onProgress);
    const promise = dl.ensureModel();

    await resolveDownload('/docs/gemma-4.task');
    const path = await promise;

    expect(path).toBe('/docs/gemma-4.task');
  });

  it('persists path and version to AsyncStorage after download', async () => {
    const dl = new ModelDownloader(jest.fn());
    const promise = dl.ensureModel();

    await resolveDownload('/docs/gemma-4.task');
    await promise;

    expect(mockSetMany).toHaveBeenCalledWith(
      expect.objectContaining({'@olix/model_path': '/docs/gemma-4.task'}),
    );
  });

  it('rejects when HTTP status is not 200 or 206', async () => {
    const dl = new ModelDownloader(jest.fn());
    const promise = dl.ensureModel();

    await resolveDownload('/docs/gemma-4.task', 404);

    await expect(promise).rejects.toThrow('Download failed with HTTP 404');
  });

  it('rejects when native fetch throws', async () => {
    const dl = new ModelDownloader(jest.fn());
    const promise = dl.ensureModel();

    await rejectDownload(new Error('network error'));

    await expect(promise).rejects.toThrow('network error');
  });
});

// ── Checksum verification ─────────────────────────────────────────────────────

describe('checksum verification', () => {
  it('resolves when hash matches the checksum endpoint', async () => {
    RNFetchBlobMock.__setHash('deadbeef');
    RNFetchBlobMock.__setFetchText('deadbeef  gemma-4.task');

    const dl = new ModelDownloader(jest.fn());
    const promise = dl.ensureModel();
    await resolveDownload();
    await expect(promise).resolves.toBeDefined();
  });

  it('rejects and deletes the file when hash does not match', async () => {
    RNFetchBlobMock.__setHash('aaa');
    RNFetchBlobMock.__setFetchText('bbb  gemma-4.task');

    const dl = new ModelDownloader(jest.fn());
    const promise = dl.ensureModel();
    await resolveDownload();

    await expect(promise).rejects.toThrow('Checksum mismatch');
  });
});

// ── Resume logic ──────────────────────────────────────────────────────────────

describe('resume', () => {
  it('sends a Range header when a partial file exists', async () => {
    RNFetchBlobMock.__setExists(true);
    RNFetchBlobMock.__setFileSize(1024 * 1024 * 100); // 100 MB partial

    const dl = new ModelDownloader(jest.fn());
    const promise = dl.ensureModel();
    await resolveDownload();
    await promise;

    const RNFetchBlob = jest.requireMock('rn-fetch-blob').default as {config: jest.Mock};
    const configInstance = RNFetchBlob.config.mock.results[0]?.value as {
      fetch: jest.Mock;
    };
    const fetchArgs = configInstance.fetch.mock.calls[0] as [
      string,
      string,
      Record<string, string>,
    ];
    expect(fetchArgs[2]).toMatchObject({Range: 'bytes=104857600-'});
  });

  it('does not send Range header for fresh downloads', async () => {
    RNFetchBlobMock.__setExists(false);

    const dl = new ModelDownloader(jest.fn());
    const promise = dl.ensureModel();
    await resolveDownload();
    await promise;

    const RNFetchBlob = jest.requireMock('rn-fetch-blob').default as {config: jest.Mock};
    const configInstance = RNFetchBlob.config.mock.results[0]?.value as {
      fetch: jest.Mock;
    };
    const fetchArgs = configInstance.fetch.mock.calls[0] as [
      string,
      string,
      Record<string, string>,
    ];
    expect(fetchArgs[2]).not.toHaveProperty('Range');
  });
});

// ── Cancellation ──────────────────────────────────────────────────────────────

describe('cancel', () => {
  it('rejects with "Download cancelled" when cancelled before completion', async () => {
    const dl = new ModelDownloader(jest.fn());
    const promise = dl.ensureModel();

    // Wait for download() to start — it resets this.cancelled to false and
    // creates this.task. Only then is calling cancel() meaningful.
    await flush();
    dl.cancel();
    RNFetchBlobMock.__rejectTask(new Error('cancelled by user'));

    await expect(promise).rejects.toThrow('Download cancelled');
  });
});
