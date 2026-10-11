import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FAIL_TOGGLE_ENV, PNPM_BASIC_SPECS } from './test/common/fixture-workspace.const.ts';
import type { TurboRun } from './test/common/fixture-workspace.type.ts';
import { createSyncedWorkspace } from './test/utils/atomizer-setup.spec.util.ts';
import { isPmSelected } from './test/utils/e2e-env.spec.util.ts';
import {
  failedFileTaskIds,
  fileTaskId,
  fileTaskIds,
  missedFileTaskIds,
  missedTaskIds,
  summarizedRun
} from './test/utils/turbo-summary.spec.util.ts';
import { cloneFixtureWorkspace } from './test/utils/workspace-clone.spec.util.ts';
import { outputOf } from './test/utils/workspace-command.spec.util.ts';

const ALL_FILE_TASKS = PNPM_BASIC_SPECS.map(fileTaskId);
const FAILING_TASK = fileTaskId('tests/profile.spec.ts');

const retryCommand = (cacheDir: string): string => `turbo run e2e-ci --continue=dependencies-successful --cache-dir=${cacheDir}`;

describe('FEATURE: CI retry with a shared turbo cache', (): void => {
  describe.runIf(isPmSelected('pnpm'))(
    'GIVEN attempt 1 in a fresh workspace and attempt 2 in a fresh clone of it, sharing one cache dir',
    (): void => {
      const cleanups: (() => Promise<void>)[] = [];
      let firstAttempt: TurboRun;
      let secondAttempt: TurboRun;

      beforeAll(async (): Promise<void> => {
        const cacheDir = await mkdtemp(join(tmpdir(), 'ta-e2e-cache-'));

        cleanups.push(async (): Promise<void> => rm(cacheDir, { force: true, recursive: true }));

        const first = await createSyncedWorkspace('pnpm-basic', 'pnpm');

        cleanups.push(first.dispose);
        firstAttempt = await summarizedRun(first.root, retryCommand(cacheDir), { [FAIL_TOGGLE_ENV]: '1' });

        const second = await cloneFixtureWorkspace(first, 'pnpm');

        cleanups.push(second.dispose);
        // The clone's servers use the same ports, so attempt 1's supervisor must be gone first.
        await first.dispose();
        secondAttempt = await summarizedRun(second.root, retryCommand(cacheDir));
      });

      // vitest skips the teardown a failed beforeAll would return, but always runs afterAll
      afterAll(async (): Promise<void> => {
        for (const cleanup of cleanups) await cleanup();
      });

      it('WHEN attempt 1 runs with the fail toggle on THEN only the toggled file task fails and the run exits non-zero', (): void => {
        expect(firstAttempt.result.exitCode, outputOf(firstAttempt.result)).not.toBe(0);
        expect(missedFileTaskIds(firstAttempt.tasks)).toEqual(ALL_FILE_TASKS);
        expect(failedFileTaskIds(firstAttempt.tasks)).toEqual([FAILING_TASK]);
      });

      it('WHEN attempt 2 runs with the toggle off THEN exactly the failed file task executes and every other task is a cache hit', (): void => {
        expect(secondAttempt.result, outputOf(secondAttempt.result)).toMatchObject({ exitCode: 0 });
        expect(fileTaskIds(secondAttempt.tasks)).toEqual(ALL_FILE_TASKS);
        expect(missedTaskIds(secondAttempt.tasks)).toEqual([FAILING_TASK]);
      });
    }
  );
});
