import { execFile } from 'node:child_process';
import { link, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import { lockOwnerSchema } from '../common/rendezvous-lock.schema.ts';
import type { LockOwner } from '../common/server.type.ts';
import { errorCode } from '../utils/errno.util.ts';

type HolderState = 'missing' | 'live' | 'stale';

const execFileAsync = promisify(execFile);

/** `ps` start time, so a reused pid is told apart from the owner; '' when `ps` is unavailable. */
const processStartTime = async (pid: number): Promise<string> => {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'lstart=', '-p', String(pid)]);

    return stdout.trim();
  } catch {
    return '';
  }
};

const isPidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return errorCode(error) === 'EPERM';
  }
};

const readOwner = async (lockPath: string): Promise<LockOwner | undefined> => {
  const text = await readFile(lockPath, 'utf8');

  try {
    const raw: unknown = JSON.parse(text);
    const parsed = lockOwnerSchema.safeParse(raw);

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

const holderState = async (lockPath: string): Promise<HolderState> => {
  let owner: LockOwner | undefined;

  try {
    owner = await readOwner(lockPath);
  } catch (error) {
    const code = errorCode(error);

    if (code === 'ENOENT') return 'missing';

    throw error;
  }

  if (owner === undefined) return 'stale';

  const isAlive = isPidAlive(owner.pid);

  if (!isAlive) return 'stale';

  const startTime = await processStartTime(owner.pid);
  const isReused = startTime !== '' && startTime !== owner.startTime;

  return isReused ? 'stale' : 'live';
};

/** Exclusive create with the owner already inside: `link` fails with EEXIST like `O_EXCL`, and no reader ever sees an empty lock. */
const createLock = async (lockPath: string, owner: LockOwner): Promise<boolean> => {
  const draftPath = `${lockPath}.${String(owner.pid)}.tmp`;

  await writeFile(draftPath, JSON.stringify(owner));

  try {
    await link(draftPath, lockPath);

    return true;
  } catch (error) {
    const code = errorCode(error);

    if (code === 'EEXIST') return false;

    throw error;
  } finally {
    await rm(draftPath, { force: true });
  }
};

const takeOverStaleLock = async (lockPath: string): Promise<boolean> => {
  const stalePath = `${lockPath}.${String(process.pid)}.stale`;

  try {
    await rename(lockPath, stalePath);
  } catch {
    return false;
  }

  await rm(stalePath, { force: true });

  return true;
};

/** POSIX supervisor lock (spec §7 Rendezvous): a lock whose owner is gone is renamed away, then the create is retried once. */
export const acquireLock = async (lockPath: string): Promise<boolean> => {
  const startTime = await processStartTime(process.pid);
  const owner: LockOwner = { pid: process.pid, startTime };
  const isCreated = await createLock(lockPath, owner);

  if (isCreated) return true;

  const state = await holderState(lockPath);

  if (state === 'live') return false;

  if (state === 'stale') {
    const isTaken = await takeOverStaleLock(lockPath);

    if (!isTaken) return false;
  }

  return createLock(lockPath, owner);
};

/** Removes the lock only when this process owns it. */
export const releaseLock = async (lockPath: string): Promise<void> => {
  const owner = await readOwner(lockPath).catch((): undefined => undefined);

  if (owner?.pid !== process.pid) return;

  await rm(lockPath, { force: true });
};
