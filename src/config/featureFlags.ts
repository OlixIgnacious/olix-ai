/**
 * Feature flags — AsyncStorage-backed with safe-off defaults.
 *
 * Flags are loaded once at app startup via initFeatureFlags().
 * Future: replace the AsyncStorage source with Firebase Remote Config
 * (requires @react-native-firebase/remote-config + google-services.json).
 *
 * Usage:
 *   import {getFlag} from '@/config/featureFlags';
 *   if (getFlag('modelUpdatesEnabled')) { ... }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {logger} from '@/utils/logger';

export type FeatureFlags = {
  modelUpdatesEnabled: boolean;
};

const DEFAULTS: FeatureFlags = {
  modelUpdatesEnabled: false,
};

const STORAGE_KEY = '@olix/feature_flags';

let _flags: FeatureFlags = {...DEFAULTS};

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  return _flags[key];
}

// ─── Init (call once on app start) ────────────────────────────────────────────

/**
 * Load persisted flags from AsyncStorage and merge over defaults.
 * Safe to call multiple times — idempotent.
 */
export async function initFeatureFlags(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<FeatureFlags>;
      _flags = {...DEFAULTS, ...stored};
      logger.debug('featureFlags: loaded from storage', _flags);
    }
  } catch (err) {
    logger.error('featureFlags: failed to load from storage', err);
    // Keep defaults — app stays functional
  }
}

// ─── Write (for remote config overrides or dev tools) ────────────────────────

/**
 * Override flags and persist them so they survive restarts.
 * In production this is called by the Firebase Remote Config listener.
 */
export async function applyRemoteFlags(overrides: Partial<FeatureFlags>): Promise<void> {
  _flags = {...DEFAULTS, ...overrides};
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_flags));
    logger.debug('featureFlags: persisted overrides', _flags);
  } catch (err) {
    logger.error('featureFlags: failed to persist overrides', err);
  }
}
