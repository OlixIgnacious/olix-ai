import {AppConfig} from '@/config/env';

function shouldLog(): boolean {
  return AppConfig.isDev;
}

export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    if (shouldLog()) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]): void => {
    if (shouldLog()) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]): void => {
    if (shouldLog()) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, error?: unknown): void => {
    if (shouldLog()) {
      console.error(`[ERROR] ${message}`, error);
    }
    // QA + Prod: errors will be forwarded to Sentry (Phase 3)
  },
};
