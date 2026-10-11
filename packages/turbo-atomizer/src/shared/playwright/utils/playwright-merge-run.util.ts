import { PLAYWRIGHT_HTML_OPEN_ENV } from '../common/playwright.const.ts';

/** The html reporter never opens: a CLI that waits on a served report would hang CI and scripts. */
export const toPlaywrightMergeEnv = (baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...baseEnv, [PLAYWRIGHT_HTML_OPEN_ENV]: 'never' };

  return env;
};

/** A `close` code of `null` means the child died by a signal, which counts as 1. */
export const toPlaywrightMergeExitCode = (code: number | null): number => code ?? 1;
