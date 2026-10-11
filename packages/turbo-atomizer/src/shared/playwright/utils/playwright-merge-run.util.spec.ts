import { describe, expect, it } from 'vitest';

import { toPlaywrightMergeEnv, toPlaywrightMergeExitCode } from './playwright-merge-run.util.ts';
import { PLAYWRIGHT_HTML_OPEN_ENV } from '../common/playwright.const.ts';

describe('FEATURE: Playwright merge run', (): void => {
  describe('GIVEN a base env that asks the html reporter to open', (): void => {
    const baseEnv: NodeJS.ProcessEnv = { HOME: '/home/user', [PLAYWRIGHT_HTML_OPEN_ENV]: 'always' };

    it('WHEN the merge env is built THEN the html report never opens', (): void => {
      const env = toPlaywrightMergeEnv(baseEnv);

      expect(env[PLAYWRIGHT_HTML_OPEN_ENV]).toBe('never');
    });

    it('WHEN the merge env is built THEN the rest of the base env is kept', (): void => {
      const env = toPlaywrightMergeEnv(baseEnv);

      expect(env['HOME']).toBe('/home/user');
    });
  });

  describe('GIVEN a merge child that closed', (): void => {
    it('WHEN it exited with a code THEN that code is returned', (): void => {
      const exitCode = toPlaywrightMergeExitCode(2);

      expect(exitCode).toBe(2);
    });

    it('WHEN it was killed by a signal THEN 1 is returned', (): void => {
      const exitCode = toPlaywrightMergeExitCode(null);

      expect(exitCode).toBe(1);
    });
  });
});
