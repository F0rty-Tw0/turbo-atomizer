import { lstat, mkdir } from 'node:fs/promises';

import { ServerFailedException } from '../common/server-failed.exception.ts';
import { errorCode } from '../utils/errno.util.ts';

const PRIVATE_DIR_MODE = 0o700;
const GROUP_AND_OTHER_BITS = 0o077;

const makeDir = async (dir: string): Promise<void> => {
  try {
    await mkdir(dir, { mode: PRIVATE_DIR_MODE });
  } catch (error) {
    const code = errorCode(error);

    if (code !== 'EEXIST') throw error;
  }
};

/**
 * Creates the per-user rendezvous dir with mode 0700 when missing, then refuses it unless it is a real directory (not a
 * symlink) owned by `uid` that no other user can enter, so no one else can plant or swap the socket and lock inside.
 */
export const ensurePrivateDir = async (dir: string, uid: number): Promise<void> => {
  await makeDir(dir);

  const stats = await lstat(dir);
  const isDirectory = stats.isDirectory();
  const isShared = (stats.mode & GROUP_AND_OTHER_BITS) !== 0;
  const isPrivate = isDirectory && stats.uid === uid && !isShared;

  if (!isPrivate) throw new ServerFailedException(`${dir} must be a directory owned by uid ${String(uid)} with mode 0700; remove it and retry`, '');
};

/** Rejects when a socket at `socketPath` belongs to another uid, so its `ready.env` is never trusted; a missing socket passes. */
export const refuseForeignSocket = async (socketPath: string, uid: number): Promise<void> => {
  const stats = await lstat(socketPath).catch((error: unknown): undefined => {
    const code = errorCode(error);

    if (code === 'ENOENT') return undefined;

    throw error;
  });

  if (stats === undefined || stats.uid === uid) return;

  throw new ServerFailedException(`${socketPath} is owned by uid ${String(stats.uid)}, not ${String(uid)}; refusing to connect`, '');
};
