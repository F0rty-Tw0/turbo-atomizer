import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runPlaywrightTest } from './playwright-test.process.ts';
import { fixtureDirectory } from '../../test/utils/fixture-copy.spec.util.ts';
import type { PlaywrightExit, PlaywrightTestRun } from '../common/exec.type.ts';

const RUN_TIMEOUT_MS = 60_000;
const SLOW_BIN_MANIFEST = '{ "name": "@playwright/test", "bin": { "playwright": "cli.js" } }\n';
const SLOW_BIN_SCRIPT = 'setTimeout(() => {}, 5000);\n';
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

  describe('GIVEN a Playwright bin that waits 5 seconds before exiting', (): void => {
    let slowPackageDir: string;

    beforeAll(async (): Promise<void> => {
      slowPackageDir = await mkdtemp(join(tmpdir(), 'atomizer-signal-'));

      const binDir = join(slowPackageDir, 'node_modules/@playwright/test');

      await mkdir(binDir, { recursive: true });
      await writeFile(join(binDir, 'package.json'), SLOW_BIN_MANIFEST);
      await writeFile(join(binDir, 'cli.js'), SLOW_BIN_SCRIPT);
    });

    afterAll(async (): Promise<void> => {
      await rm(slowPackageDir, { force: true, recursive: true });
    });

    it(
      'WHEN SIGTERM reaches the process THEN the child is killed with it and the forwarder is removed',
      async (): Promise<void> => {
        const listenersBefore = process.listeners('SIGTERM');
        const run: PlaywrightTestRun = { args: ['test'], cwd: slowPackageDir, env: process.env };
        const expected: PlaywrightExit = { code: null, signal: 'SIGTERM' };

        const pending = runPlaywrightTest(run);
        const isNewListener = (listener: NodeJS.SignalsListener): boolean => !listenersBefore.includes(listener);
        const forward = process.listeners('SIGTERM').find(isNewListener);

        forward?.('SIGTERM');

        const exit = await pending;

        expect(exit).toEqual(expected);
        expect(process.listeners('SIGTERM')).toEqual(listenersBefore);
      },
      RUN_TIMEOUT_MS
    );
  });
});
