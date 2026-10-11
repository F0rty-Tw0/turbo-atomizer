import type { Server, Socket } from 'node:net';

import { acquireLock, releaseLock } from '../data-access/rendezvous.lock.ts';
import { closeRendezvous, listenRendezvous, removeStaleSocket } from '../data-access/rendezvous.socket.ts';
import { lockPathOf } from '../utils/rendezvous-path.util.ts';

const isWindows = process.platform === 'win32';

/**
 * Spec §7 Start step 2: take the lock (POSIX), clear a stale socket, then bind. Undefined means another supervisor won.
 * On Windows a second `listen` on the named pipe fails with EADDRINUSE, so no lock is needed.
 */
export const claimRendezvous = async (socketPath: string, onConnection: (socket: Socket) => void): Promise<Server | undefined> => {
  if (isWindows) return listenRendezvous(socketPath, onConnection);

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
