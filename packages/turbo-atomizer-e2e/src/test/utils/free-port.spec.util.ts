import { once } from 'node:events';
import type { Server } from 'node:net';
import { createServer } from 'node:net';

/** Ports come from 20000–31999, below Linux's ephemeral range (32768+), so no outgoing socket or `listen(0)` takes one between release and the fixture server's bind. */
const PORT_RANGE_START = 20_000;

const PORT_RANGE_SIZE = 12_000;

const randomPort = (): number => PORT_RANGE_START + Math.floor(Math.random() * PORT_RANGE_SIZE);

/** Binds a random port in the range, trying another one while the bind fails (EADDRINUSE). */
const listenOnFreePort = async (): Promise<Server> => {
  const server = createServer();

  server.listen(randomPort(), '127.0.0.1');

  try {
    await once(server, 'listening');
  } catch {
    return listenOnFreePort();
  }

  return server;
};

const releasePort = async (server: Server): Promise<number> => {
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  server.close();
  await once(server, 'close');

  return port;
};

/** `count` distinct free ports, bound and then released; all are held until each is allocated, so none repeats. */
export const freePorts = async (count: number): Promise<number[]> => {
  const servers = await Promise.all(Array.from({ length: count }, listenOnFreePort));

  return Promise.all(servers.map(releasePort));
};
