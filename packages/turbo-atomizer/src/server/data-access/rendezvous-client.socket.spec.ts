import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { connectSocket, onServerMessages } from './rendezvous-client.socket.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';
import { errorCode } from '../utils/errno.util.ts';

const RAW_LINES = '{"state":"starting"}\nnot json\n{"state":"bogus"}\n{"state":"ready","env":{"PORT":"1"}}\n';

const writeRawLines = (socket: Socket): void => {
  socket.end(RAW_LINES);
};

const connectError = async (socketPath: string): Promise<string | undefined> => {
  try {
    await connectSocket(socketPath);

    return undefined;
  } catch (error) {
    return errorCode(error);
  }
};

describe('FEATURE: rendezvous client socket', (): void => {
  let directory: string;
  let socketPath: string;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'atomizer-client-'));
    socketPath = join(directory, 'ta-test.sock');
  });

  afterEach(async (): Promise<void> => {
    await rm(directory, { force: true, recursive: true });
  });

  describe('GIVEN no listener', (): void => {
    it('WHEN a client connects THEN it rejects with ENOENT', async (): Promise<void> => {
      const code = await connectError(socketPath);

      expect(code).toBe('ENOENT');
    });
  });

  describe('GIVEN a listener writing valid and invalid lines', (): void => {
    let server: Server;

    beforeEach(async (): Promise<void> => {
      server = createServer(writeRawLines);
      server.listen(socketPath);
      await once(server, 'listening');
    });

    afterEach(async (): Promise<void> => {
      server.close();
      await once(server, 'close');
    });

    it('WHEN the messages are read THEN only protocol messages arrive, in order', async (): Promise<void> => {
      const starting: ServerMessage = { state: 'starting' };
      const env = { PORT: '1' };
      const ready: ServerMessage = { state: 'ready', env };
      const socket = await connectSocket(socketPath);
      const messages: ServerMessage[] = [];

      onServerMessages(socket, (message): number => messages.push(message));
      await once(socket, 'close');

      expect(messages).toEqual([starting, ready]);
    });
  });
});
