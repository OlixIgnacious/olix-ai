/**
 * Feature flags — AsyncStorage-backed, overridable via Firebase Remote Config.
 * Default values are safe-off. Phase 7 wires Firebase Remote Config.
 */
export type FeatureFlags = {
  modelUpdatesEnabled: boolean;
};

const DEFAULTS: FeatureFlags = {
  modelUpdatesEnabled: false,
};

let _flags: FeatureFlags = {...DEFAULTS};

export function getFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  return _flags[key];
}

/** Called during app init once remote config is fetched (Phase 7). */
export function applyRemoteFlags(overrides: Partial<FeatureFlags>): void {
  _flags = {...DEFAULTS, ...overrides};
}
