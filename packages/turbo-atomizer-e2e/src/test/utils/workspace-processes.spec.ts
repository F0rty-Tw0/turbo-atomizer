import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { beforeEach, describe, expect, it } from 'vitest';

import { settleWorkspaceProcesses } from './workspace-processes.spec.util.ts';

const SETTLE_MS = 1_000;

const EXIT_MS = 1_000;

const IDLE_SCRIPT = 'setTimeout(() => {}, 300_000)';

/** Starts an idle node process; `marker` lands in its command line as an argument the script ignores. */
const startIdle = (marker: string): ChildProcess => spawn(process.execPath, ['-e', IDLE_SCRIPT, marker], { stdio: 'ignore' });

/** Whether `exit` settles within `ms`. */
const exitsWithin = async (exit: Promise<unknown>, ms: number): Promise<boolean> => {
  const exited = exit.then((): boolean => true);

  return Promise.race([exited, sleep(ms, false)]);
};

describe('FEATURE: workspace processes', (): void => {
  describe('GIVEN a workspace whose start log holds the pid of a running process', (): void => {
    let root = '';

    const logPid = async (child: ChildProcess): Promise<void> => {
      await mkdir(join(root, '.atomizer'), { recursive: true });
      await writeFile(join(root, '.atomizer', 'starts.log'), `${String(child.pid)}\n`);
    };

    beforeEach(async (): Promise<() => Promise<void>> => {
      root = await mkdtemp(join(tmpdir(), 'ta-e2e-processes-'));

      return async (): Promise<void> => rm(root, { force: true, recursive: true });
    });

    it('WHEN the process is unrelated to the workspace THEN settling leaves it running', async (): Promise<void> => {
      const child = startIdle('unrelated');
      const exit = once(child, 'exit');

      await logPid(child);
      await settleWorkspaceProcesses(root, SETTLE_MS);

      const exited = await exitsWithin(exit, EXIT_MS);

      child.kill('SIGKILL');

      expect(exited).toBe(false);
    });

    it('WHEN the process is a fixture server THEN settling kills it', async (): Promise<void> => {
      const child = startIdle('server.js');
      const exit = once(child, 'exit');

      await logPid(child);
      await settleWorkspaceProcesses(root, SETTLE_MS);

      const exited = await exitsWithin(exit, EXIT_MS);

      child.kill('SIGKILL');

      expect(exited).toBe(true);
    });
  });
});
