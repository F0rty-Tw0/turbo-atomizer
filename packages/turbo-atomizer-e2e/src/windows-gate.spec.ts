import { setTimeout as sleep } from 'node:timers/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  E2E_HANG_ENV,
  PNPM_BASIC_SPECS,
  TEST_PACKAGE_DIR,
  TURBO_ATOMIZER_ARGS_ENV,
  TURBO_SCM_BASE_ENV
} from './test/common/fixture-workspace.const.ts';
import type { FixtureWorkspace } from './test/common/fixture-workspace.type.ts';
import type { TurboRunSnapshot } from './test/common/workspace-process.type.ts';
import { createSyncedWorkspace } from './test/utils/atomizer-setup.spec.util.ts';
import { isPmSelected } from './test/utils/e2e-env.spec.util.ts';
import { pollUntil } from './test/utils/poll.spec.util.ts';
import { startedPids } from './test/utils/server-starts.spec.util.ts';
import { fileTaskId, missedFileTaskIds, summarizedRun } from './test/utils/turbo-summary.spec.util.ts';
import {
  browserRunSnapshot,
  longestCommandLine,
  setServerIdleMs,
  supervisorsOf,
  survivorsOf,
  taskkill
} from './test/utils/windows-gate.spec.util.ts';
import { windowsProcesses } from './test/utils/windows-processes.spec.util.ts';
import { outputOf, startCommand } from './test/utils/workspace-command.spec.util.ts';
import { isAlive, killQuietly } from './test/utils/workspace-processes.spec.util.ts';

const IS_WINDOWS = process.platform === 'win32';
// long enough that the supervisor stays up between the runs of this file
const SERVER_IDLE_MS = 60_000;
const SERVER_EXIT_MS = 5_000;
const ORPHAN_WAIT_MS = 10_000;
const RUN_START_MS = 120_000;
// CreateProcess limit on a command line, in UTF-16 units
const WINDOWS_COMMAND_LINE_LIMIT = 32_767;
const ALL_FILE_TASKS = PNPM_BASIC_SPECS.map(fileTaskId);
const GREP_ARGS = JSON.stringify(['--grep', 'sign in is offered']);
const AFFECTED_FILTER = '--filter=web-e2e';

describe('FEATURE: Windows gate', (): void => {
  describe.runIf(IS_WINDOWS && isPmSelected('pnpm'))(
    'GIVEN the pnpm-basic workspace on Windows, synced with a 60 s server idle, walked through in order',
    (): void => {
      let workspace: FixtureWorkspace;
      let serverPid = 0;

      beforeAll(async (): Promise<() => Promise<void>> => {
        workspace = await createSyncedWorkspace('pnpm-basic', 'pnpm');

        try {
          await setServerIdleMs(workspace, SERVER_IDLE_MS);
        } catch (error) {
          await workspace.dispose();

          throw error;
        }

        return workspace.dispose;
      });

      it('WHEN e2e-ci runs THEN every generated command gets its args intact, and turbo returns while the server idles under one supervisor', async (): Promise<void> => {
        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci');
        const processes = await windowsProcesses();
        const pids = await startedPids(workspace.root, 'starts');

        serverPid = pids.at(-1) ?? 0;

        // a garbled spec path selects no tests, and the zero-test guard fails that file task
        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(missedFileTaskIds(run.tasks)).toEqual(ALL_FILE_TASKS);
        expect(pids).toHaveLength(1);
        expect(isAlive(serverPid)).toBe(true);
        expect(supervisorsOf(processes, workspace.root)).toHaveLength(1);
      });

      it('WHEN TURBO_ATOMIZER_ARGS holds a JSON grep with spaces THEN the args reach Playwright whole and the server is reused', async (): Promise<void> => {
        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci --force', { [TURBO_ATOMIZER_ARGS_ENV]: GREP_ARGS });
        const pids = await startedPids(workspace.root, 'starts');

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(run.result.stdout).toContain('sign in is offered');
        expect(run.result.stdout).not.toContain('cart is linked');
        expect(pids).toEqual([serverPid]);
      });

      it('WHEN taskkill /T ends the supervisor tree THEN no server pid is left', async (): Promise<void> => {
        const before = await windowsProcesses();
        const [supervisor] = supervisorsOf(before, workspace.root);
        const supervisorPid = supervisor?.pid ?? 0;

        expect(supervisorPid).not.toBe(0);

        await taskkill(supervisorPid, true);

        const serverExited = async (): Promise<true | undefined> => {
          const processes = await windowsProcesses();
          const isRunning = processes.some((entry): boolean => entry.pid === serverPid);

          return isRunning ? undefined : true;
        };

        await pollUntil(serverExited, SERVER_EXIT_MS, `server pid ${String(serverPid)} to exit`);

        const after = await windowsProcesses();

        expect(supervisorsOf(after, workspace.root)).toEqual([]);
      });

      it('WHEN turbo is killed mid-run THEN no process of its Playwright run remains 10 s later', async (): Promise<void> => {
        // every test holds open for 120 s, so a process of the run is gone 10 s after the kill only because the kill ended it
        const running = startCommand(workspace.root, 'turbo run e2e-ci --force', { [E2E_HANG_ENV]: '1' });

        const browserRunning = async (): Promise<TurboRunSnapshot | undefined> => {
          const processes = await windowsProcesses();

          return browserRunSnapshot(processes, running.pid, workspace.root);
        };

        const snapshot = await pollUntil(browserRunning, RUN_START_MS, 'a headless browser under turbo.exe');

        await taskkill(snapshot.turboPid, false);
        await running.result;
        await sleep(ORPHAN_WAIT_MS);

        const after = await windowsProcesses();
        const survivors = survivorsOf(snapshot.processes, after);

        survivors.forEach((entry): void => killQuietly(entry.pid));

        expect(survivors).toEqual([]);
      });

      it('WHEN every spec changed after the committed base THEN the argv turbo-atomizer affected builds fits the Windows limit', async (): Promise<void> => {
        await workspace.commit('gate base');

        const base = await workspace.run('git rev-parse HEAD');
        const edits = PNPM_BASIC_SPECS.map(async (spec): Promise<void> => {
          const path = `${TEST_PACKAGE_DIR}/${spec}`;
          const text = await workspace.read(path);

          await workspace.edit(path, `${text}// affected\n`);
        });

        await Promise.all(edits);

        const running = startCommand(workspace.root, 'turbo-atomizer affected --', { [TURBO_SCM_BASE_ENV]: base.stdout.trim() });

        const affectedRunning = async (): Promise<number | undefined> => {
          const processes = await windowsProcesses();

          return longestCommandLine(processes, AFFECTED_FILTER);
        };

        const longest = await pollUntil(affectedRunning, RUN_START_MS, 'the turbo run of turbo-atomizer affected');
        const result = await running.result;

        process.stdout.write(
          `windows-gate: affected turbo command line ${String(longest)} chars for ${String(PNPM_BASIC_SPECS.length)} file tasks (limit ${String(WINDOWS_COMMAND_LINE_LIMIT)})\n`
        );

        expect(result, outputOf(result)).toMatchObject({ exitCode: 0 });
        expect(longest).toBeLessThan(WINDOWS_COMMAND_LINE_LIMIT);
      });
    }
  );
});
