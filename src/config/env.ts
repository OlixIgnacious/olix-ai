import Config from 'react-native-config';
import {NativeModules} from 'react-native';

type AppEnv = 'dev' | 'qa' | 'prod';

/**
 * Resolve APP_ENV from native BuildConfig, falling back to react-native-config.
 *
 * react-native-config resolves BuildConfig via context.getPackageName() which
 * returns the applicationId. For non-prod Android flavors (dev, qa) the
 * applicationId differs from the Gradle namespace ("com.olix"), so the class
 * lookup fails and Config.APP_ENV comes back as undefined.
 *
 * OlixBuildConfigModule imports com.olix.BuildConfig directly and exposes
 * APP_ENV as a synchronous constant — this is the authoritative source.
 * react-native-config is kept as a secondary fallback (it works for prod and
 * all iOS builds). If both fail, we fall back to 'dev' in non-production
 * contexts so the app never crashes at startup over a missing env value.
 */
function resolveEnv(): AppEnv {
  // Primary: OlixBuildConfigModule (reads com.olix.BuildConfig directly — always correct)
  const nativeValue = NativeModules.OlixBuildConfig?.APP_ENV as string | undefined;
  if (nativeValue === 'dev' || nativeValue === 'qa' || nativeValue === 'prod') {
    return nativeValue;
  }

  // Secondary: react-native-config (works for prod Android + all iOS)
  const rcValue = Config.APP_ENV;
  if (rcValue === 'dev' || rcValue === 'qa' || rcValue === 'prod') {
    return rcValue;
  }

  // Tertiary: dev fallback so Metro / debuggable builds never crash
  if (__DEV__) {
    return 'dev';
  }

  // Last resort — should not happen in a correctly configured prod build, but
  // better a warning + 'dev' behaviour than a white-screen crash.
  console.warn(`[env] Could not resolve APP_ENV (got "${nativeValue ?? rcValue ?? 'undefined'}"). Defaulting to 'dev'.`);
  return 'dev';
}

function resolveString(value: string | undefined, name: string, fallback?: string): string {
  if (value) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  if (__DEV__) {
    // Don't crash in dev — log and return a placeholder so screens still render.
    console.warn(`[env] Missing required env variable: ${name}`);
    return '';
  }
  throw new Error(`Missing required env variable: ${name}`);
}

export const ENV: AppEnv = resolveEnv();

export const AppConfig = {
  env: ENV,
  isDev: ENV === 'dev',
  isQA: ENV === 'qa',
  isProd: ENV === 'prod',
  displayName: resolveString(Config.APP_DISPLAY_NAME, 'APP_DISPLAY_NAME', 'Olix'),
  bundleId: resolveString(Config.BUNDLE_ID, 'BUNDLE_ID', 'com.olix.dev'),
  modelCdnUrl: resolveString(
    Config.MODEL_CDN_URL,
    'MODEL_CDN_URL',
    'https://dev-cdn.example.com/models',
  ),
  sentryDsn: Config.SENTRY_DSN ?? '',
} as const;
