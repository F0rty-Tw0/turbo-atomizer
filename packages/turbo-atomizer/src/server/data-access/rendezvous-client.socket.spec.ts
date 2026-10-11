import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { connectSocket, onVerifiedMessages } from './rendezvous-client.socket.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';
import { OTHER_TOKEN_STUB, POISONED_READY_LINE_STUB, TOKEN_STUB } from '../test/stubs/rendezvous-token.stub.ts';
import { listenAsSupervisor } from '../test/utils/fake-supervisor.spec.util.ts';
import { errorCode } from '../utils/errno.util.ts';

const RAW_LINES = '{"state":"starting"}\nnot json\n{"state":"bogus"}\n{"state":"ready","env":{"PORT":"1"}}\n';
const READY_LINE = '{"state":"ready","env":{"PORT":"1"}}\n';

type Exchange = {
  readonly messages: ServerMessage[];
  readonly refused: boolean;
  readonly firstLine: string;
};

const connectError = async (socketPath: string): Promise<string | undefined> => {
  try {
    await connectSocket(socketPath);

    return undefined;
  } catch (error) {
    return errorCode(error);
  }
};

const listenRaw = async (socketPath: string, lines: string): Promise<Server> => {
  const server = createServer((socket: Socket): void => void socket.end(lines));

  server.listen(socketPath);
  await once(server, 'listening');

  return server;
};

/** Runs one verified exchange until the listener hangs up; `firstLine` is what a read-only eavesdropper sees first. */
const exchange = async (socketPath: string, token: string): Promise<Exchange> => {
  const socket = await connectSocket(socketPath);
  const messages: ServerMessage[] = [];
  let refused = false;
  let received = '';

  const onRefused = (): void => {
    refused = true;
    socket.destroy();
  };

  socket.on('error', (): undefined => undefined);
  socket.on('data', (chunk: Buffer): void => void (received += chunk.toString()));
  onVerifiedMessages(socket, token, { onMessage: (message): number => messages.push(message), onRefused });
  await once(socket, 'close');

  const [firstLine = ''] = received.split('\n');
  const result: Exchange = { messages, refused, firstLine };

  return result;
};

describe('FEATURE: rendezvous client socket', (): void => {
  let directory: string;
  let socketPath: string;
  let server: Server | undefined;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'atomizer-client-'));
    socketPath = join(directory, 'ta-test.sock');
    server = undefined;
  });

  afterEach(async (): Promise<void> => {
    server?.close();
    await rm(directory, { force: true, recursive: true });
  });

  describe('GIVEN no listener', (): void => {
    it('WHEN a client connects THEN it rejects with ENOENT', async (): Promise<void> => {
      const code = await connectError(socketPath);

      expect(code).toBe('ENOENT');
    });
  });

  describe('GIVEN a listener holding the token and writing valid and invalid lines', (): void => {
    it('WHEN the messages are read THEN only protocol messages arrive, in order', async (): Promise<void> => {
      const starting: ServerMessage = { state: 'starting' };
      const env = { PORT: '1' };
      const ready: ServerMessage = { state: 'ready', env };

      server = await listenAsSupervisor(socketPath, TOKEN_STUB, (socket: Socket): void => void socket.end(RAW_LINES));

      const { messages, refused } = await exchange(socketPath, TOKEN_STUB);

      expect(refused).toBe(false);
      expect(messages).toEqual([starting, ready]);
    });
  });

  describe('GIVEN a squatter that knows the socket but proves another token', (): void => {
    it('WHEN its poisoned ready is read THEN the client refuses it and no message arrives', async (): Promise<void> => {
      server = await listenAsSupervisor(socketPath, OTHER_TOKEN_STUB, (socket: Socket): void => void socket.end(POISONED_READY_LINE_STUB));

      const { messages, refused } = await exchange(socketPath, TOKEN_STUB);

      expect(refused).toBe(true);
      expect(messages).toEqual([]);
    });
  });

  describe('GIVEN a squatter that replies ready without any proof', (): void => {
    it('WHEN its poisoned ready is read THEN the client refuses it and no message arrives', async (): Promise<void> => {
      server = await listenRaw(socketPath, POISONED_READY_LINE_STUB);

      const { messages, refused } = await exchange(socketPath, TOKEN_STUB);

      expect(refused).toBe(true);
      expect(messages).toEqual([]);
    });
  });

  describe('GIVEN a proof an eavesdropper read from a real exchange', (): void => {
    it('WHEN a squatter replays it to a fresh client THEN the client refuses it', async (): Promise<void> => {
      const holder = await listenAsSupervisor(socketPath, TOKEN_STUB, (socket: Socket): void => void socket.end(READY_LINE));
      const { firstLine } = await exchange(socketPath, TOKEN_STUB);

      holder.close();
      await once(holder, 'close');
      server = await listenRaw(socketPath, `${firstLine}\n${POISONED_READY_LINE_STUB}`);

      const replayed = await exchange(socketPath, TOKEN_STUB);

      expect(firstLine).toMatch(/^\{"proof":"[0-9a-f]{64}"\}$/);
      expect(replayed.refused).toBe(true);
      expect(replayed.messages).toEqual([]);
    });
  });
});
