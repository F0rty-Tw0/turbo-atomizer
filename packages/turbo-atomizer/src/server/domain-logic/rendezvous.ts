import type { Server, Socket } from 'node:net';
import { tmpdir, userInfo } from 'node:os';
import { dirname } from 'node:path';

import { acquireLock, releaseLock } from '../data-access/rendezvous.lock.ts';
import { ensurePrivateDir, refuseForeignSocket } from '../data-access/rendezvous.path.ts';
import { closeRendezvous, listenRendezvous, removeStaleSocket } from '../data-access/rendezvous.socket.ts';
import { lockPathOf, rendezvousPath } from '../utils/rendezvous-path.util.ts';

const isWindows = process.platform === 'win32';

/** Undefined on Windows, where a named pipe has no file owner. */
const ownUid = process.getuid?.();

/** The uid on POSIX, never `os.userInfo()`, which throws for a uid without a passwd entry (containers run with `--user`). */
const ownUser = (): string => {
  if (ownUid !== undefined) return String(ownUid);

  const { username } = userInfo();

  return username;
};

/** Spec §7 Rendezvous: this user's socket for the package, or this user's named pipe on Windows. */
export const ownRendezvousPath = (packageDir: string): string => {
  return rendezvousPath(packageDir, process.platform, tmpdir(), ownUser());
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
