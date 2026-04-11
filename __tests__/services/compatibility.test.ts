/**
 * Unit tests for the compatibility service.
 *
 * evaluateCompatibility() is pure — no native modules needed.
 * getCachedCompatibility() and runCompatibilityCheck() are tested
 * with AsyncStorage and react-native-device-info fully mocked.
 */

import {Platform} from 'react-native';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('react-native-device-info', () => ({
  getTotalMemory: jest.fn(),
  getFreeDiskStorage: jest.fn(),
  getSystemVersion: jest.fn(),
  getApiLevel: jest.fn(),
}));

jest.mock('react-native-config', () => ({
  APP_ENV: 'dev',
  APP_DISPLAY_NAME: 'Olix Dev',
  BUNDLE_ID: 'com.olix.dev',
  MODEL_CDN_URL: 'https://dev-cdn.example.com/models',
  SENTRY_DSN: '',
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import {
  evaluateCompatibility,
  getCachedCompatibility,
  runCompatibilityCheck,
  type DeviceSnapshot,
} from '../../src/services/compatibility';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GB = 1024 * 1024 * 1024;

const passingSnapshot: DeviceSnapshot = {
  totalRamBytes: 8 * GB, // 8 GB — above 6 GB minimum
  freeStorageBytes: 4 * GB, // 4 GB — above 2.5 GB minimum
  osVersion: '17.0',
  androidApiLevel: 0, // irrelevant on iOS
};

function iosSnapshot(overrides: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return {...passingSnapshot, ...overrides};
}

function androidSnapshot(overrides: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return {
    ...passingSnapshot,
    osVersion: '8.1.0',
    androidApiLevel: 27, // Android 8.1
    ...overrides,
  };
}

// ─── evaluateCompatibility — iOS ─────────────────────────────────────────────

describe('evaluateCompatibility (iOS)', () => {
  beforeAll(() => {
    Platform.OS = 'ios';
  });

  it('returns compatible:true when all checks pass', () => {
    expect(evaluateCompatibility(iosSnapshot())).toEqual({compatible: true});
  });

  it('fails when RAM is below 6 GB', () => {
    const result = evaluateCompatibility(iosSnapshot({totalRamBytes: 4 * GB}));
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toMatch(/Insufficient RAM/);
      expect(result.reasons[0]).toMatch(/4\.0 GB detected/);
    }
  });

  it('fails when free storage is below 2.5 GB', () => {
    const result = evaluateCompatibility(iosSnapshot({freeStorageBytes: 1 * GB}));
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toMatch(/Insufficient free storage/);
      expect(result.reasons[0]).toMatch(/1\.0 GB available/);
    }
  });

  it('fails when iOS version is below 16', () => {
    const result = evaluateCompatibility(iosSnapshot({osVersion: '15.7'}));
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toMatch(/iOS 15\.7 is not supported/);
    }
  });

  it('passes on exactly iOS 16.0', () => {
    expect(evaluateCompatibility(iosSnapshot({osVersion: '16.0'}))).toEqual({compatible: true});
  });

  it('accumulates multiple failure reasons', () => {
    const result = evaluateCompatibility(
      iosSnapshot({
        totalRamBytes: 3 * GB,
        freeStorageBytes: 0.5 * GB,
        osVersion: '14.0',
      }),
    );
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reasons).toHaveLength(3);
      expect(result.reasons[0]).toMatch(/RAM/);
      expect(result.reasons[1]).toMatch(/storage/);
      expect(result.reasons[2]).toMatch(/iOS/);
    }
  });

  it('fails RAM only when storage and OS pass', () => {
    const result = evaluateCompatibility(iosSnapshot({totalRamBytes: 2 * GB}));
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toMatch(/RAM/);
    }
  });

  it('fails storage only when RAM and OS pass', () => {
    const result = evaluateCompatibility(iosSnapshot({freeStorageBytes: 1.5 * GB}));
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toMatch(/storage/);
    }
  });
});

// ─── evaluateCompatibility — Android ─────────────────────────────────────────

describe('evaluateCompatibility (Android)', () => {
  beforeAll(() => {
    Platform.OS = 'android';
  });

  afterAll(() => {
    Platform.OS = 'ios';
  });

  it('returns compatible:true when all checks pass', () => {
    expect(evaluateCompatibility(androidSnapshot())).toEqual({compatible: true});
  });

  it('fails when Android API level is below 26', () => {
    const result = evaluateCompatibility(androidSnapshot({androidApiLevel: 24}));
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toMatch(/API 24/);
      expect(result.reasons[0]).toMatch(/Android 8\.0/);
    }
  });

  it('passes on exactly API 26', () => {
    expect(evaluateCompatibility(androidSnapshot({androidApiLevel: 26}))).toEqual({
      compatible: true,
    });
  });

  it('fails RAM + API together', () => {
    const result = evaluateCompatibility(
      androidSnapshot({totalRamBytes: 4 * GB, androidApiLevel: 21}),
    );
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reasons).toHaveLength(2);
    }
  });
});

// ─── getCachedCompatibility ───────────────────────────────────────────────────

describe('getCachedCompatibility', () => {
  const mockGetItem = AsyncStorage.getItem as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it('returns compatible:true when cache holds "true"', async () => {
    mockGetItem.mockResolvedValueOnce('true');
    await expect(getCachedCompatibility()).resolves.toEqual({compatible: true});
  });

  it('returns null when cache is empty', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await expect(getCachedCompatibility()).resolves.toBeNull();
  });

  it('returns null when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('disk error'));
    await expect(getCachedCompatibility()).resolves.toBeNull();
  });
});

// ─── runCompatibilityCheck — integration ─────────────────────────────────────

describe('runCompatibilityCheck', () => {
  const mockGetItem = AsyncStorage.getItem as jest.Mock;
  const mockSetItem = AsyncStorage.setItem as jest.Mock;
  const mockGetTotalMemory = DeviceInfo.getTotalMemory as jest.Mock;
  const mockGetFreeDiskStorage = DeviceInfo.getFreeDiskStorage as jest.Mock;
  const mockGetSystemVersion = DeviceInfo.getSystemVersion as jest.Mock;

  beforeAll(() => {
    Platform.OS = 'ios';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null); // no cache by default
    mockGetTotalMemory.mockResolvedValue(8 * GB);
    mockGetFreeDiskStorage.mockResolvedValue(4 * GB);
    mockGetSystemVersion.mockReturnValue('17.0');
  });

  it('returns cached result without hitting device info', async () => {
    mockGetItem.mockResolvedValueOnce('true');
    const result = await runCompatibilityCheck();
    expect(result).toEqual({compatible: true});
    expect(mockGetTotalMemory).not.toHaveBeenCalled();
  });

  it('runs live checks and caches result on pass', async () => {
    const result = await runCompatibilityCheck();
    expect(result).toEqual({compatible: true});
    expect(mockSetItem).toHaveBeenCalledWith('@olix/compatibility_result', 'true');
  });

  it('does not cache result on fail', async () => {
    mockGetTotalMemory.mockResolvedValueOnce(2 * GB); // fail RAM
    const result = await runCompatibilityCheck();
    expect(result.compatible).toBe(false);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('returns fail with specific reasons on partial failure', async () => {
    mockGetFreeDiskStorage.mockResolvedValueOnce(0.5 * GB); // fail storage only
    const result = await runCompatibilityCheck();
    expect(result.compatible).toBe(false);
    if (!result.compatible) {
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toMatch(/storage/);
    }
  });
});
