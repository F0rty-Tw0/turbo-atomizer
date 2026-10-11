import { rm } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';

import { connectSocket } from './rendezvous-client.socket.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';
import { errorCode } from '../utils/errno.util.ts';

/**
 * True when `socketPath` is free to bind. A socket file is unlinked only after a connect to it fails with
 * ECONNREFUSED, so a live supervisor's socket is never removed.
 */
export const removeStaleSocket = async (socketPath: string): Promise<boolean> => {
  try {
    const socket = await connectSocket(socketPath);

    socket.destroy();

    return false;
  } catch (error) {
    const code = errorCode(error);

    if (code === 'ENOENT') return true;

    if (code !== 'ECONNREFUSED') return false;

    await rm(socketPath, { force: true });

    return true;
  }
};

/** Listens on the rendezvous; resolves undefined when another process already holds it (EADDRINUSE). */
export const listenRendezvous = async (socketPath: string, onConnection: (socket: Socket) => void): Promise<Server | undefined> => {
  const server = createServer(onConnection);

  return new Promise((resolve, reject): void => {
    const onError = (error: Error): void => {
      const code = errorCode(error);

      if (code === 'EADDRINUSE') return void resolve(undefined);

      reject(error);
    };

    server.once('error', onError);
    server.listen(socketPath, (): void => {
      server.off('error', onError);
      resolve(server);
    });
  });
};

export const sendMessage = (socket: Socket, message: ServerMessage): void => {
  const line = `${JSON.stringify(message)}\n`;

  socket.write(line);
};

/** Stops listening and removes the socket file; open connections must already be destroyed. */
export const closeRendezvous = async (server: Server): Promise<void> => {
  return new Promise((resolve): void => {
    server.close((): void => resolve());
  });
};
