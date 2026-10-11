import { once } from 'node:events';
import type { Server } from 'node:net';
import { createServer } from 'node:net';

const listenOnFreePort = async (): Promise<Server> => {
  const server = createServer();

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  return server;
};

const releasePort = async (server: Server): Promise<number> => {
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  server.close();
  await once(server, 'close');

  return port;
};

/** `count` distinct ports the OS just handed out and released; all are held until each is allocated, so none repeats. */
export const freePorts = async (count: number): Promise<number[]> => {
  const servers = await Promise.all(Array.from({ length: count }, listenOnFreePort));

  return Promise.all(servers.map(releasePort));
};
