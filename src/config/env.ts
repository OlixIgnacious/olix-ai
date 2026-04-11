import Config from 'react-native-config';

type AppEnv = 'dev' | 'qa' | 'prod';

function assertString(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return value;
}

function assertEnv(value: string | undefined): AppEnv {
  if (value !== 'dev' && value !== 'qa' && value !== 'prod') {
    throw new Error(`Invalid APP_ENV value: "${value ?? 'undefined'}". Must be dev, qa, or prod.`);
  }
  return value;
}

export const ENV: AppEnv = assertEnv(Config.APP_ENV);

export const AppConfig = {
  env: ENV,
  isDev: ENV === 'dev',
  isQA: ENV === 'qa',
  isProd: ENV === 'prod',
  displayName: assertString(Config.APP_DISPLAY_NAME, 'APP_DISPLAY_NAME'),
  bundleId: assertString(Config.BUNDLE_ID, 'BUNDLE_ID'),
  modelCdnUrl: assertString(Config.MODEL_CDN_URL, 'MODEL_CDN_URL'),
  sentryDsn: Config.SENTRY_DSN ?? '',
} as const;
