import { rm } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';

import { connectSocket } from './rendezvous-client.socket.ts';
import { nonceLineSchema } from '../common/server-protocol.schema.ts';
import type { ProofLine, ServerMessage } from '../common/server-protocol.type.ts';
import { MAX_NONCE_LINE_LENGTH } from '../common/server.const.ts';
import { errorCode } from '../utils/errno.util.ts';
import { parseJsonLine } from '../utils/json-line.util.ts';

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

/**
 * Spec §7 handshake: the client's nonce from its first line, or undefined when that line is malformed, too long, or
 * missing after `timeoutMs`, or the client hangs up first. Later bytes are read and ignored; the unref'd deadline never
 * keeps the process alive.
 */
export const readNonce = async (socket: Socket, timeoutMs: number): Promise<string | undefined> => {
  return new Promise((resolve): void => {
    let buffered = '';
    let isDone = false;

    const finish = (nonce: string | undefined): void => {
      isDone = true;
      resolve(nonce);
    };

    const onData = (chunk: Buffer): void => {
      if (isDone) return;

      buffered += chunk.toString();

      const end = buffered.indexOf('\n');
      const isTooLong = end === -1 && buffered.length > MAX_NONCE_LINE_LENGTH;

      if (isTooLong) return void finish(undefined);

      if (end === -1) return;

      const nonceLine = parseJsonLine(buffered.slice(0, end), nonceLineSchema);

      finish(nonceLine?.nonce);
    };

    const deadline = setTimeout((): void => finish(undefined), timeoutMs);

    deadline.unref();
    socket.on('data', onData);
    socket.once('close', (): void => finish(undefined));
  });
};

export const sendProof = (socket: Socket, proof: string): void => {
  const proofLine: ProofLine = { proof };

  socket.write(`${JSON.stringify(proofLine)}\n`);
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
