import { once } from 'node:events';
import { access, mkdtemp, rm } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { connectSocket, onServerMessages } from './rendezvous-client.socket.ts';
import { closeRendezvous, listenRendezvous, removeStaleSocket, sendMessage } from './rendezvous.socket.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';
import { READY_MESSAGE_STUB } from '../test/stubs/supervisor-state.stub.ts';
import { createStaleSocket } from '../test/utils/stale-socket.spec.util.ts';

const ignoreConnection = (socket: Socket): void => {
  socket.end();
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
};

describe('FEATURE: rendezvous socket', (): void => {
  let directory: string;
  let socketPath: string;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'atomizer-socket-'));
    socketPath = join(directory, 'ta-test.sock');
  });

  afterEach(async (): Promise<void> => {
    await rm(directory, { force: true, recursive: true });
  });

  describe('GIVEN no socket file', (): void => {
    it('WHEN stale sockets are removed THEN the path is reported free', async (): Promise<void> => {
      const isFree = await removeStaleSocket(socketPath);

      expect(isFree).toBe(true);
    });
  });

  describe('GIVEN a socket file whose listener died', (): void => {
    it('WHEN stale sockets are removed THEN the refused socket is unlinked', async (): Promise<void> => {
      await createStaleSocket(socketPath);

      const isFree = await removeStaleSocket(socketPath);

      expect(isFree).toBe(true);
      await expect(exists(socketPath)).resolves.toBe(false);
    });
  });

  describe('GIVEN a live listener on the socket', (): void => {
    let live: Server;

    beforeEach(async (): Promise<void> => {
      live = createServer(ignoreConnection);
      live.listen(socketPath);
      await once(live, 'listening');
    });

    afterEach(async (): Promise<void> => {
      live.close();
      await once(live, 'close');
    });

    it('WHEN stale sockets are removed THEN the live socket is never unlinked', async (): Promise<void> => {
      const isFree = await removeStaleSocket(socketPath);

      expect(isFree).toBe(false);
      await expect(exists(socketPath)).resolves.toBe(true);
    });

    it('WHEN a second listener binds THEN it gets no server', async (): Promise<void> => {
      const server = await listenRendezvous(socketPath, ignoreConnection);

      expect(server).toBeUndefined();
    });
  });

  describe('GIVEN a rendezvous listening on a free path', (): void => {
    let server: Server | undefined;

    beforeEach(async (): Promise<void> => {
      const sendReady = (socket: Socket): void => sendMessage(socket, READY_MESSAGE_STUB);

      server = await listenRendezvous(socketPath, sendReady);
    });

    afterEach(async (): Promise<void> => {
      if (server !== undefined) await closeRendezvous(server);
    });

    it('WHEN a client connects THEN it reads the sent message', async (): Promise<void> => {
      const socket = await connectSocket(socketPath);
      const received = new Promise<ServerMessage>((resolve): void => onServerMessages(socket, resolve));

      const message = await received;

      socket.destroy();
      expect(message).toEqual(READY_MESSAGE_STUB);
    });

    it('WHEN the rendezvous closes THEN its socket file is gone', async (): Promise<void> => {
      if (server !== undefined) await closeRendezvous(server);

      server = undefined;

      await expect(exists(socketPath)).resolves.toBe(false);
    });
  });
});
