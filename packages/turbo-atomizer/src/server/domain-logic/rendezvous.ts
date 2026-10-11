import type { Server, Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { RENDEZVOUS_TOKEN_FILE } from '../common/server.const.ts';
import { acquireLock, releaseLock } from '../data-access/rendezvous.lock.ts';
import { ensurePrivateDir, readOrCreateToken, refuseForeignSocket } from '../data-access/rendezvous.path.ts';
import { closeRendezvous, listenRendezvous, removeStaleSocket } from '../data-access/rendezvous.socket.ts';
import { lockPathOf, rendezvousPath } from '../utils/rendezvous-path.util.ts';

const isWindows = process.platform === 'win32';

/** Undefined on Windows, where a named pipe has no file owner. */
const ownUid = process.getuid?.();

/**
 * The uid on POSIX, never `os.userInfo()`, which throws for a uid without a passwd entry (containers run with `--user`).
 * On Windows a random token, since a named pipe has no file owner to check and a hashed user name is guessable.
 */
const userKeyOn = (platform: NodeJS.Platform, tmpDir: string): string => {
  if (platform !== 'win32') return String(ownUid);

  const tokenPath = join(tmpDir, RENDEZVOUS_TOKEN_FILE);

  return readOrCreateToken(tokenPath);
};

/** Spec §7 Rendezvous: this user's socket for the package on `platform`, or this user's named pipe on Windows. */
export const rendezvousPathOn = (packageDir: string, platform: NodeJS.Platform, tmpDir: string): string => {
  const userKey = userKeyOn(platform, tmpDir);

  return rendezvousPath(packageDir, platform, tmpDir, userKey);
};

export const ownRendezvousPath = (packageDir: string): string => {
  return rendezvousPathOn(packageDir, process.platform, tmpdir());
};

/** Where only this user can read: the per-user `%TEMP%` on Windows, the private 0700 rendezvous dir on POSIX. */
const tokenDirOn = (socketPath: string, platform: NodeJS.Platform, tmpDir: string): string => {
  if (platform === 'win32') return tmpDir;

  return dirname(socketPath);
};

/** Spec §7 Rendezvous: the token keying the handshake proof; on POSIX the private dir must already be prepared. */
export const rendezvousTokenOn = (socketPath: string, platform: NodeJS.Platform, tmpDir: string): string => {
  const tokenDir = tokenDirOn(socketPath, platform, tmpDir);
  const tokenPath = join(tokenDir, RENDEZVOUS_TOKEN_FILE);

  return readOrCreateToken(tokenPath);
};

export const ownRendezvousToken = (socketPath: string): string => {
  return rendezvousTokenOn(socketPath, process.platform, tmpdir());
};

/** POSIX: creates or verifies the private per-user dir that holds the socket and its lock. */
export const preparePrivateDir = async (socketPath: string): Promise<void> => {
  if (ownUid === undefined) return;

  await ensurePrivateDir(dirname(socketPath), ownUid);
};

/** POSIX: rejects a socket another uid owns, before any connect, so a planted listener never hands exec its env. */
export const refuseForeignListener = async (socketPath: string): Promise<void> => {
  if (ownUid === undefined) return;

  await refuseForeignSocket(socketPath, ownUid);
};

/**
 * Spec §7 Start step 2: verify the private dir and take the lock (POSIX), clear a stale socket, then bind. Undefined means another supervisor won.
 * On Windows a second `listen` on the named pipe fails with EADDRINUSE, so no lock is needed.
 */
export const claimRendezvous = async (socketPath: string, onConnection: (socket: Socket) => void): Promise<Server | undefined> => {
  if (isWindows) return listenRendezvous(socketPath, onConnection);

  await preparePrivateDir(socketPath);

  const lockPath = lockPathOf(socketPath);
  const isLocked = await acquireLock(lockPath);

  if (!isLocked) return undefined;

  const isFree = await removeStaleSocket(socketPath);

  if (!isFree) {
    await releaseLock(lockPath);

    return undefined;
  }

  const server = await listenRendezvous(socketPath, onConnection);

  if (server === undefined) await releaseLock(lockPath);

  return server;
};

/** Closes the socket first, then drops the lock, so no newcomer binds while this supervisor still listens. */
export const releaseRendezvous = async (server: Server, socketPath: string): Promise<void> => {
  await closeRendezvous(server);

  if (isWindows) return;

  await releaseLock(lockPathOf(socketPath));
};
