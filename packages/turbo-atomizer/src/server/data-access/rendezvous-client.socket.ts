import { randomBytes } from 'node:crypto';
import type { Socket } from 'node:net';
import { connect } from 'node:net';
import { createInterface } from 'node:readline';

import { proofLineSchema, serverMessageSchema } from '../common/server-protocol.schema.ts';
import type { NonceLine, ServerMessage, ServerMessageHandlers } from '../common/server-protocol.type.ts';
import { NONCE_BYTES } from '../common/server.const.ts';
import { parseJsonLine } from '../utils/json-line.util.ts';
import { isProofOf } from '../utils/rendezvous-proof.util.ts';

type Handshake = 'pending' | 'verified' | 'refused';

const isProofLine = (line: string, token: string, nonce: string): boolean => {
  const proofLine = parseJsonLine(line, proofLineSchema);

  if (proofLine === undefined) return false;

  return isProofOf(proofLine.proof, token, nonce);
};

const deliver = (line: string, onMessage: (message: ServerMessage) => void): void => {
  const message = parseJsonLine(line, serverMessageSchema);

  if (message !== undefined) onMessage(message);
};

/** Connects to a Unix socket or named pipe; rejects with the errno error (ENOENT, ECONNREFUSED) when nothing listens. */
export const connectSocket = async (socketPath: string): Promise<Socket> => {
  return new Promise((resolve, reject): void => {
    const socket = connect(socketPath);

    const onConnect = (): void => {
      socket.off('error', reject);
      resolve(socket);
    };

    socket.once('connect', onConnect);
    socket.once('error', reject);
  });
};

/**
 * Spec §7 handshake: sends a fresh nonce, then calls `onMessage` for every protocol message once the first line proves
 * the listener holds `token`; lines that fail the schema are dropped. Any other first line calls `onRefused`, and
 * nothing after it is delivered.
 */
export const onVerifiedMessages = (socket: Socket, token: string, handlers: ServerMessageHandlers): void => {
  const nonce = randomBytes(NONCE_BYTES).toString('hex');
  const nonceLine: NonceLine = { nonce };
  const lines = createInterface({ input: socket });
  let handshake: Handshake = 'pending';

  const onLine = (line: string): void => {
    if (handshake === 'refused') return;

    if (handshake === 'verified') return void deliver(line, handlers.onMessage);

    const isVerified = isProofLine(line, token, nonce);

    handshake = isVerified ? 'verified' : 'refused';

    if (!isVerified) handlers.onRefused();
  };

  lines.on('line', onLine);
  socket.write(`${JSON.stringify(nonceLine)}\n`);
};
