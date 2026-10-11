// TEMPORARY CI probe (PR #9, S1), removed before the PR is ready: times variants of the WMI launch inside and outside a turbo task.
import { cp } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { isPmSelected } from './test/utils/e2e-env.spec.util.ts';
import { createFixtureWorkspace } from './test/utils/fixture-workspace.spec.util.ts';
import { outputOf } from './test/utils/workspace-command.spec.util.ts';

const IS_WINDOWS = process.platform === 'win32';
const PROBE_DIR = join(import.meta.dirname, 'test/fixtures/job-probe');
const PROBE_TIMEOUT_MS = 1_500_000;
const OUTPUT_TAIL = 4000;

const missingReport = (): string => 'null';

describe('FEATURE: job probe', (): void => {
  describe.runIf(IS_WINDOWS && isPmSelected('npm'))('GIVEN the npm-basic workspace with a probe as the web build', (): void => {
    it(
      'WHEN turbo runs the probe THEN the timing of each launch variant is printed',
      async (): Promise<void> => {
        const workspace = await createFixtureWorkspace('npm-basic', 'npm');

        try {
          await cp(PROBE_DIR, join(workspace.root, 'apps/web'), { recursive: true });

          const run = await workspace.run('turbo run build --force');
          const direct = await workspace.run('node apps/web/build.js direct');
          const inTurbo = await workspace.read('apps/web/probe-turbo.json').catch(missingReport);
          const outsideTurbo = await workspace.read('apps/web/probe-direct.json').catch(missingReport);
          const output = outputOf(run).slice(-OUTPUT_TAIL);
          const directOutput = outputOf(direct).slice(-OUTPUT_TAIL);

          console.warn(`JOB-PROBE-TURBO ${inTurbo}`);
          console.warn(`JOB-PROBE-DIRECT ${outsideTurbo}`);
          console.warn(`JOB-PROBE-OUTPUT ${JSON.stringify({ exitCode: run.exitCode, output, directOutput })}`);

          expect(run.exitCode, output).toBe(0);
        } finally {
          await workspace.dispose();
        }
      },
      PROBE_TIMEOUT_MS
    );
  });
});
