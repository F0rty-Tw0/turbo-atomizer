import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { lockOwnerSchema } from '../../common/rendezvous-lock.schema.ts';
import { lockPathOf, rendezvousPath } from '../../utils/rendezvous-path.util.ts';

const execFileAsync = promisify(execFile);

const killQuietly = (pid: number): void => {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // already gone
  }
};

const lockOwnerPid = async (lockPath: string): Promise<number | undefined> => {
  try {
    const text = await readFile(lockPath, 'utf8');
    const raw: unknown = JSON.parse(text);
    const parsed = lockOwnerSchema.safeParse(raw);

    return parsed.success ? parsed.data.pid : undefined;
  } catch {
    return undefined;
  }
};

/** Pids `static-server.mjs --starts-log .atomizer/starts.log` recorded, one per start. */
export const startedPids = async (packageDir: string): Promise<number[]> => {
  const text = await readFile(join(packageDir, '.atomizer/starts.log'), 'utf8').catch((): string => '');
  const lines = text.split('\n').filter(Boolean);

  return lines.map(Number);
};

/**
 * Kills every supervisor spawned for the package (the lock owner and any loser still booting, matched by the package dir
 * in their argv) and every server they started, then clears the rendezvous files.
 */
export const killSupervisor = async (packageDir: string): Promise<void> => {
  const socketPath = rendezvousPath(packageDir, process.platform, tmpdir());
  const lockPath = lockPathOf(socketPath);
  const supervisorPid = await lockOwnerPid(lockPath);
  const serverPids = await startedPids(packageDir);

  if (supervisorPid !== undefined) killQuietly(supervisorPid);

  await execFileAsync('pkill', ['-KILL', '-f', packageDir]).catch((): undefined => undefined);
  serverPids.forEach(killQuietly);
  await rm(socketPath, { force: true });
  await rm(lockPath, { force: true });
};
