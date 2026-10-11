import type { Socket } from 'node:net';
import { connect } from 'node:net';
import { createInterface } from 'node:readline';

import { serverMessageSchema } from '../common/server-protocol.schema.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';

const parseMessage = (line: string): ServerMessage | undefined => {
  try {
    const raw: unknown = JSON.parse(line);
    const parsed = serverMessageSchema.safeParse(raw);

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
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

/** Calls `onMessage` for every newline-delimited protocol message; lines that fail the schema are dropped. */
export const onServerMessages = (socket: Socket, onMessage: (message: ServerMessage) => void): void => {
  const lines = createInterface({ input: socket });

  const onLine = (line: string): void => {
    const message = parseMessage(line);

    if (message !== undefined) onMessage(message);
  };

  lines.on('line', onLine);
};
