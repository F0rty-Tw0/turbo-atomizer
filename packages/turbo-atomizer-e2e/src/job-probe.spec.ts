// TEMPORARY CI probe (PR #9, S1), removed before the PR is ready: prints the limit flags of the job a turbo task runs in.
import { cp } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { isPmSelected } from './test/utils/e2e-env.spec.util.ts';
import { createFixtureWorkspace } from './test/utils/fixture-workspace.spec.util.ts';
import { outputOf } from './test/utils/workspace-command.spec.util.ts';

const IS_WINDOWS = process.platform === 'win32';
const PROBE_DIR = join(import.meta.dirname, 'test/fixtures/job-probe');
const PROBE_TIMEOUT_MS = 180_000;
const OUTPUT_TAIL = 4000;

const missingReport = (): string => 'null';

describe('FEATURE: job probe', (): void => {
  describe.runIf(IS_WINDOWS && isPmSelected('pnpm'))('GIVEN the pnpm-basic workspace with a probe as the web build', (): void => {
    it(
      'WHEN turbo runs the probe THEN the flags of the job it runs in are printed',
      async (): Promise<void> => {
        const workspace = await createFixtureWorkspace('pnpm-basic', 'pnpm');

        try {
          await cp(PROBE_DIR, join(workspace.root, 'apps/web'), { recursive: true });

          const run = await workspace.run('turbo run build --force');

          const text = await workspace.read('apps/web/probe.json').catch(missingReport);
          const report: unknown = JSON.parse(text);
          const output = outputOf(run).slice(-OUTPUT_TAIL);

          console.warn(`JOB-PROBE ${JSON.stringify({ exitCode: run.exitCode, report, output })}`);

          expect(run.exitCode, output).toBe(0);
        } finally {
          await workspace.dispose();
        }
      },
      PROBE_TIMEOUT_MS
    );
  });
});
