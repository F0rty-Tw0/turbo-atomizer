import { once } from 'node:events';
import { access, mkdtemp, rm } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { connectSocket, onVerifiedMessages } from './rendezvous-client.socket.ts';
import { closeRendezvous, listenRendezvous, readNonce, removeStaleSocket, sendMessage, sendProof } from './rendezvous.socket.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';
import { NONCE_TIMEOUT_MS } from '../common/server.const.ts';
import { TOKEN_STUB } from '../test/stubs/rendezvous-token.stub.ts';
import { READY_MESSAGE_STUB } from '../test/stubs/supervisor-state.stub.ts';
import { createStaleSocket } from '../test/utils/stale-socket.spec.util.ts';
import { proofOf } from '../utils/rendezvous-proof.util.ts';

const SHORT_NONCE_TIMEOUT_MS = 50;
const NONCE = '00112233445566778899aabbccddeeff';

const ignoreConnection = (socket: Socket): void => {
  socket.end();
};

const proveThenSendReady = async (socket: Socket): Promise<void> => {
  const nonce = await readNonce(socket, NONCE_TIMEOUT_MS);
  const proof = proofOf(TOKEN_STUB, nonce ?? '');

  sendProof(socket, proof);
  sendMessage(socket, READY_MESSAGE_STUB);
};

/** The nonce a listener reads after the client wrote `firstBytes` (or hung up, when `firstBytes` is undefined). */
const nonceAfter = async (socketPath: string, firstBytes: string | undefined): Promise<string | undefined> => {
  const { promise, resolve } = Promise.withResolvers<string | undefined>();
  const listener = createServer((socket: Socket): void => void readNonce(socket, SHORT_NONCE_TIMEOUT_MS).then(resolve));

  listener.listen(socketPath);
  await once(listener, 'listening');

  const client = await connectSocket(socketPath);

  if (firstBytes === undefined) client.destroy();
  else client.write(firstBytes);

  const nonce = await promise;

  client.destroy();
  listener.close();

  return nonce;
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
      server = await listenRendezvous(socketPath, (socket: Socket): void => void proveThenSendReady(socket));
    });

    afterEach(async (): Promise<void> => {
      if (server !== undefined) await closeRendezvous(server);
    });

    it('WHEN a client passes the handshake THEN it reads the sent message', async (): Promise<void> => {
      const socket = await connectSocket(socketPath);
      const received = new Promise<ServerMessage>((resolve, reject): void => {
        onVerifiedMessages(socket, TOKEN_STUB, { onMessage: resolve, onRefused: reject });
      });

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

  describe('GIVEN a listener reading the client nonce', (): void => {
    it('WHEN the client sends a nonce line THEN the nonce is read', async (): Promise<void> => {
      const nonce = await nonceAfter(socketPath, `{"nonce":"${NONCE}"}\n`);

      expect(nonce).toBe(NONCE);
    });

    it('WHEN the first line is not JSON THEN no nonce is read', async (): Promise<void> => {
      const nonce = await nonceAfter(socketPath, 'hello\n');

      expect(nonce).toBeUndefined();
    });

    it('WHEN the nonce is not 32 hex chars THEN no nonce is read', async (): Promise<void> => {
      const nonce = await nonceAfter(socketPath, '{"nonce":"abc"}\n');

      expect(nonce).toBeUndefined();
    });

    it('WHEN 300 bytes arrive without a newline THEN no nonce is read', async (): Promise<void> => {
      const nonce = await nonceAfter(socketPath, 'x'.repeat(300));

      expect(nonce).toBeUndefined();
    });

    it('WHEN half a line arrives and nothing more within the timeout THEN no nonce is read', async (): Promise<void> => {
      const nonce = await nonceAfter(socketPath, '{"nonce":');

      expect(nonce).toBeUndefined();
    });

    it('WHEN the client hangs up first THEN no nonce is read', async (): Promise<void> => {
      const nonce = await nonceAfter(socketPath, undefined);

      expect(nonce).toBeUndefined();
    });
  });
});
