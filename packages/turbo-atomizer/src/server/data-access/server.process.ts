import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

import { DEFAULT_GRACEFUL_SHUTDOWN } from '../common/server.const.ts';
import type { RunningServer, ServerChild } from '../common/server.type.ts';

const isWindows = process.platform === 'win32';

const hasExited = (child: ServerChild): boolean => child.exitCode !== null || child.signalCode !== null;

const signalGroup = (pid: number, signal: NodeJS.Signals): void => {
  try {
    process.kill(-pid, signal);
  } catch {
    // ESRCH: the whole group is already gone
  }
};

const killWindowsTree = async (pid: number): Promise<void> => {
  const taskkill = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });

  await once(taskkill, 'close');
};

/** Spawns `command` through the shell with exactly `env`; on POSIX it leads its own process group so the tree can be killed. */
export const spawnServer = (command: string, cwd: string, env: Record<string, string>): ServerChild => {
  return spawn(command, { cwd, detached: !isWindows, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
};

/** POSIX: `gracefulShutdown.signal` to the group, up to `gracefulShutdown.timeout` for it to close, then SIGKILL. Windows: `taskkill /T /F`. */
export const stopServer = async (server: RunningServer): Promise<void> => {
  const { child, fact } = server;
  const pid = child.pid;

  if (pid === undefined) return;

  if (isWindows) return killWindowsTree(pid);

  const shutdown = fact.gracefulShutdown ?? DEFAULT_GRACEFUL_SHUTDOWN;
  const exited = hasExited(child);

  if (!exited) {
    const closed = once(child, 'close');

    signalGroup(pid, shutdown.signal);
    await Promise.race([closed, sleep(shutdown.timeout)]);
  }

  signalGroup(pid, 'SIGKILL');
};
