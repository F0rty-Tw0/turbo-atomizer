import { once } from 'node:events';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';

import { nonceLineSchema } from '../../common/server-protocol.schema.ts';
import type { ProofLine } from '../../common/server-protocol.type.ts';
import { parseJsonLine } from '../../utils/json-line.util.ts';
import { proofOf } from '../../utils/rendezvous-proof.util.ts';

/** Answers the client's nonce line with a proof keyed by `token`, as the supervisor does, then hands the socket to `onClient`. */
const proveThen = (socket: Socket, token: string, onClient: (socket: Socket) => void): void => {
  const lines = createInterface({ input: socket });

  const onFirstLine = (line: string): void => {
    const nonceLine = parseJsonLine(line, nonceLineSchema);

    if (nonceLine === undefined) return void socket.destroy();

    const proofLine: ProofLine = { proof: proofOf(token, nonceLine.nonce) };

    socket.write(`${JSON.stringify(proofLine)}\n`);
    onClient(socket);
  };

  lines.once('line', onFirstLine);
};

/** A listener on `socketPath` that passes the handshake as a holder of `token` would; a squatter when `token` is not the user's. */
export const listenAsSupervisor = async (socketPath: string, token: string, onClient: (socket: Socket) => void): Promise<Server> => {
  const server = createServer((socket: Socket): void => proveThen(socket, token, onClient));

  server.listen(socketPath);
  await once(server, 'listening');

  return server;
};
