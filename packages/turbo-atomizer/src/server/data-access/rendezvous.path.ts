import { randomBytes } from 'node:crypto';
import { existsSync, linkSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { lstat, mkdir } from 'node:fs/promises';

import { ServerFailedException } from '../common/server-failed.exception.ts';
import { PIPE_TOKEN_BYTES, PIPE_TOKEN_PATTERN } from '../common/server.const.ts';
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

/** Writes a fresh token to a draft, then hard-links it into place, so a concurrent reader never sees a half-written token. */
const createPipeToken = (tokenPath: string): void => {
  const draftPath = `${tokenPath}.${String(process.pid)}`;
  const token = randomBytes(PIPE_TOKEN_BYTES).toString('hex');

  writeFileSync(draftPath, token, { mode: 0o600 });

  try {
    linkSync(draftPath, tokenPath);
  } catch (error) {
    const code = errorCode(error);

    if (code !== 'EEXIST') throw error;
  } finally {
    rmSync(draftPath, { force: true });
  }
};

/**
 * Windows: this user's random pipe token, created on first use in the per-user tmp dir and reused after, so no other
 * user can guess the pipe name and listen on it first (spec §7 Rendezvous).
 */
export const readOrCreatePipeToken = (tokenPath: string): string => {
  const hasToken = existsSync(tokenPath);

  if (!hasToken) createPipeToken(tokenPath);

  const token = readFileSync(tokenPath, 'utf8');
  const isToken = PIPE_TOKEN_PATTERN.test(token);

  if (!isToken) throw new ServerFailedException(`${tokenPath} does not hold a 32-char hex token; remove it and retry`, '');

  return token;
};
