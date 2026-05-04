import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {logger} from '@/utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = '@olix/compatibility_result';

const REQUIREMENTS = {
  minRamBytes: 6 * 1024 * 1024 * 1024,        // 6 GB
  minFreeStorageBytes: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
  minIosVersion: 16,
  minAndroidApi: 26,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompatibilityResult = {compatible: true} | {compatible: false; reasons: string[]};

/** Raw device measurements — injectable for testing. */
export type DeviceSnapshot = {
  totalRamBytes: number;
  freeStorageBytes: number;
  /** iOS: '16.4', Android: '8.1.0' */
  osVersion: string;
  /** Android API level, e.g. 26. Always 0 on iOS. */
  androidApiLevel: number;
};

// ─── Pure logic (unit-testable, no native calls) ──────────────────────────────

/**
 * Evaluates device measurements against Exis requirements.
 * Has no side effects — safe to call in tests with any values.
 */
export function evaluateCompatibility(snapshot: DeviceSnapshot): CompatibilityResult {
  const reasons: string[] = [];

  // RAM check
  if (snapshot.totalRamBytes < REQUIREMENTS.minRamBytes) {
    const actualGb = (snapshot.totalRamBytes / (1024 * 1024 * 1024)).toFixed(1);
    reasons.push(`Insufficient RAM: ${actualGb} GB detected, 6 GB required`);
  }

  // Free storage check
  if (snapshot.freeStorageBytes < REQUIREMENTS.minFreeStorageBytes) {
    const actualGb = (snapshot.freeStorageBytes / (1024 * 1024 * 1024)).toFixed(1);
    reasons.push(`Insufficient free storage: ${actualGb} GB available, 2.5 GB required`);
  }

  // OS version check
  if (Platform.OS === 'ios') {
    const major = parseInt(snapshot.osVersion.split('.')[0] ?? '0', 10);
    if (major < REQUIREMENTS.minIosVersion) {
      reasons.push(`iOS ${snapshot.osVersion} is not supported — iOS 16 or later required`);
    }
  } else {
    if (snapshot.androidApiLevel < REQUIREMENTS.minAndroidApi) {
      reasons.push(
        `Android API ${snapshot.androidApiLevel} is not supported — Android 8.0 (API 26) or later required`,
      );
    }
  }

  if (reasons.length > 0) {
    return {compatible: false, reasons};
  }
  return {compatible: true};
}

/**
 * Returns a soft warning string if storage is tight but above the hard minimum,
 * or null if storage is fine. Does not fail — the hard check is in evaluateCompatibility.
 */
export function getStorageWarning(freeBytes: number): string | null {
  const SOFT = 3.5 * 1024 * 1024 * 1024;
  const HARD = REQUIREMENTS.minFreeStorageBytes;
  if (freeBytes >= HARD && freeBytes < SOFT) {
    const freeGB = (freeBytes / 1024 ** 3).toFixed(1);
    return `Storage is tight (${freeGB} GB free). Download may fail if space runs low.`;
  }
  return null;
}

// ─── Device info fetcher ──────────────────────────────────────────────────────

async function fetchDeviceSnapshot(): Promise<DeviceSnapshot> {
  const [totalRamBytes, freeStorageBytes, osVersion, androidApiLevel] = await Promise.all([
    DeviceInfo.getTotalMemory(),
    DeviceInfo.getFreeDiskStorage(),
    Promise.resolve(DeviceInfo.getSystemVersion()),
    Platform.OS === 'android' ? DeviceInfo.getApiLevel() : Promise.resolve(0),
  ]);

  return {totalRamBytes, freeStorageBytes, osVersion, androidApiLevel};
}

// ─── Cache ────────────────────────────────────────────────────────────────────

/**
 * Returns the cached compatible result if it exists, otherwise null.
 * We only cache `compatible: true` — storage can change between launches,
 * so an incompatible result should be re-evaluated on the next launch.
 */
export async function getCachedCompatibility(): Promise<CompatibilityResult | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw === 'true') {
      return {compatible: true};
    }
  } catch (err) {
    logger.warn('Failed to read compatibility cache', err);
  }
  return null;
}

async function cacheCompatible(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, 'true');
  } catch (err) {
    logger.warn('Failed to write compatibility cache', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs the full compatibility check:
 *   1. Returns cached result immediately if device was previously verified.
 *   2. Otherwise fetches live device info, evaluates, caches on pass.
 */
export async function runCompatibilityCheck(): Promise<CompatibilityResult> {
  const cached = await getCachedCompatibility();
  if (cached !== null) {
    logger.debug('Compatibility: using cached result (pass)');
    return cached;
  }

  logger.debug('Compatibility: running live device checks');
  const snapshot = await fetchDeviceSnapshot();
  logger.debug('Compatibility snapshot', snapshot);

  const result = evaluateCompatibility(snapshot);

  if (result.compatible) {
    await cacheCompatible();
    logger.debug('Compatibility: pass — result cached');
  } else {
    logger.debug('Compatibility: fail', result.reasons);
  }

  return result;
}
