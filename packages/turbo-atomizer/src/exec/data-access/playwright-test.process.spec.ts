import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runPlaywrightTest } from './playwright-test.process.ts';
import { fixtureDirectory } from '../../test/utils/fixture-copy.spec.util.ts';
import type { PlaywrightExit, PlaywrightTestRun } from '../common/exec.type.ts';

const RUN_TIMEOUT_MS = 60_000;
const packageDir = join(fixtureDirectory('basic'), 'apps/e2e');

describe('FEATURE: Playwright test process', (): void => {
  describe('GIVEN the basic fixture package', (): void => {
    it(
      'WHEN Playwright lists its tests THEN it exits with code 0 and no signal',
      async (): Promise<void> => {
        const run: PlaywrightTestRun = {
          args: ['test', '--list', '--config=playwright.config.ts'],
          cwd: packageDir,
          env: process.env
        };
        const expected: PlaywrightExit = { code: 0, signal: null };

        const exit = await runPlaywrightTest(run);

        expect(exit).toEqual(expected);
      },
      RUN_TIMEOUT_MS
    );

    it(
      'WHEN Playwright rejects an arg THEN its non-zero code is returned',
      async (): Promise<void> => {
        const run: PlaywrightTestRun = { args: ['test', '--list', '--workers=abc'], cwd: packageDir, env: process.env };

        const exit = await runPlaywrightTest(run);

        expect(exit.code).toBe(1);
      },
      RUN_TIMEOUT_MS
    );
  });
});
