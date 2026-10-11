import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { Server } from 'node:net';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';

import { fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';
import type { StaticServer } from '../common/server.type.ts';

const POLL_MS = 50;

const readyPort = (line: unknown): number => {
  const text = String(line);
  const port = text.slice(text.lastIndexOf(' ') + 1);

  return Number(port);
};

/** Runs the fixture's `static-server.mjs` in place with `args` and resolves once it listens. */
export const startStaticServer = async (args: string[]): Promise<StaticServer> => {
  const script = join(fixtureDirectory('server-config'), 'static-server.mjs');
  const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = createInterface({ input: child.stdout });
  const event = await once(lines, 'line');
  const line: unknown = event[0];
  const exited = once(child, 'exit');

  const stop = async (): Promise<void> => {
    child.kill('SIGKILL');
    await exited;
  };

  const server: StaticServer = { pid: child.pid ?? 0, port: readyPort(line), stop };

  return server;
};

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

/** A port the OS just handed out and released; nothing listens on it. */
export const freePort = async (): Promise<number> => {
  const [port = 0] = await freePorts(1);

  return port;
};

/** The pid of a process that already exited, for locks whose owner is gone. */
export const exitedPid = async (): Promise<number> => {
  const child = spawn(process.execPath, ['-e', '']);

  await once(child, 'exit');

  return child.pid ?? 0;
};

export const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

/** Polls `check` until it holds or `timeoutMs` passes; returns the last result. */
export const waitUntil = async (check: () => boolean, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const holds = check();

    if (holds) return true;

    await sleep(POLL_MS);
  }

  return check();
};
