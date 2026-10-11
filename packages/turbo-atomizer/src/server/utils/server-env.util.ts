import { TURBO_ATOMIZER_DESCRIBE_ENV, TURBO_ATOMIZER_SERVER_ENV_ENV } from '../../shared/atomizer/common/atomizer.const.ts';
import { PLAYWRIGHT_JSON_OUTPUT_FILE_ENV } from '../../shared/playwright/common/playwright.const.ts';
import { SERVER_DEFAULT_ENV } from '../common/server.const.ts';

const LISTING_ONLY_ENV: string[] = [PLAYWRIGHT_JSON_OUTPUT_FILE_ENV, TURBO_ATOMIZER_DESCRIBE_ENV, TURBO_ATOMIZER_SERVER_ENV_ENV];

const isServerVariable = ([name]: [string, string]): boolean => !LISTING_ONLY_ENV.includes(name);

/** Playwright's server env: its defaults, then the env the config was resolved in, then `webServer.env`. */
export const serverEnvOf = (captured: Record<string, string>, entryEnv: Record<string, string> | undefined): Record<string, string> => {
  const capturedEntries = Object.entries(captured).filter(isServerVariable);
  const capturedEnv = Object.fromEntries(capturedEntries);
  const env = { ...SERVER_DEFAULT_ENV, ...capturedEnv, ...entryEnv };

  return env;
};
