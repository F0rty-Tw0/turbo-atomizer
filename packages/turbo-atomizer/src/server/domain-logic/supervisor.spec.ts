import { once } from 'node:events';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ownRendezvousPath } from './rendezvous.ts';
import { runSupervisor } from './supervisor.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';
import { connectSocket, onServerMessages } from '../data-access/rendezvous-client.socket.ts';
import { freePort } from '../test/utils/static-server.spec.util.ts';
import { lockPathOf } from '../utils/rendezvous-path.util.ts';

const RUN_TIMEOUT_MS = 30_000;
const LISTEN_WAIT_MS = 10_000;
const PREVIOUS_LOG = 'previous run\n';

const endConnection = (socket: Socket): void => {
  socket.end();
};

const exists = async (path: string): Promise<boolean> => {
  return access(path).then(
    (): boolean => true,
    (): boolean => false
  );
};

const connectWhenListening = async (socketPath: string): Promise<Socket> => {
  const listening = { timeout: LISTEN_WAIT_MS, interval: 50 };

  await vi.waitFor(async (): Promise<void> => access(socketPath), listening);

  return connectSocket(socketPath);
};

const readyMessage = async (socket: Socket): Promise<ServerMessage> => {
  return new Promise((resolve): void => {
    const onMessage = (message: ServerMessage): void => {
      if (message.state !== 'starting') resolve(message);
    };

    onServerMessages(socket, onMessage);
  });
};

describe('FEATURE: supervisor', (): void => {
  let copy: FixtureCopy;
  let socketPath: string;

  beforeEach(async (): Promise<void> => {
    copy = await copyFixture('server-config');
    await mkdir(join(copy.directory, '.atomizer'));
    socketPath = ownRendezvousPath(copy.directory);
    await mkdir(dirname(socketPath), { recursive: true, mode: 0o700 });

    const port = await freePort();

    vi.stubEnv('ATOMIZER_FIXTURE_PORT', String(port));
  });

  afterEach(async (): Promise<void> => {
    vi.unstubAllEnvs();
    await copy.dispose();
  });

  describe('GIVEN another live listener on the rendezvous', (): void => {
    let live: Server;

    beforeEach(async (): Promise<void> => {
      live = createServer(endConnection);
      live.listen(socketPath);
      await once(live, 'listening');
    });

    afterEach(async (): Promise<void> => {
      live.close();
      await once(live, 'close');
    });

    it('WHEN the supervisor runs THEN it exits at once and never unlinks the live socket', async (): Promise<void> => {
      await runSupervisor(copy.directory, 'playwright.config.ts', new PassThrough());

      await expect(exists(socketPath)).resolves.toBe(true);
      await expect(exists(lockPathOf(socketPath))).resolves.toBe(false);
    });

    it('WHEN the supervisor runs THEN it leaves server.log as it was', async (): Promise<void> => {
      const logPath = join(copy.directory, '.atomizer/server.log');

      await writeFile(logPath, PREVIOUS_LOG);
      await runSupervisor(copy.directory, 'playwright.config.ts', new PassThrough());

      await expect(readFile(logPath, 'utf8')).resolves.toBe(PREVIOUS_LOG);
      await expect(exists(`${logPath}.1`)).resolves.toBe(false);
    });
  });

  describe('GIVEN a free rendezvous and a package with idleMs 500', (): void => {
    it('WHEN one client is served and leaves THEN the supervisor exits and frees the rendezvous', async (): Promise<void> => {
      const run = runSupervisor(copy.directory, 'playwright.config.ts', new PassThrough());

      const client = await connectWhenListening(socketPath);
      const message = await readyMessage(client);

      client.destroy();
      await run;

      expect(message.state).toBe('ready');
      await expect(exists(socketPath)).resolves.toBe(false);
      await expect(exists(lockPathOf(socketPath))).resolves.toBe(false);
    }, RUN_TIMEOUT_MS);
  });

  describe('GIVEN a free rendezvous and a server.log from a previous run', (): void => {
    it('WHEN the supervisor claims the rendezvous THEN the previous log moves to server.log.1 and server.log starts over', async (): Promise<void> => {
      const logPath = join(copy.directory, '.atomizer/server.log');

      await writeFile(logPath, PREVIOUS_LOG);

      const run = runSupervisor(copy.directory, 'playwright.config.ts', new PassThrough());
      const client = await connectWhenListening(socketPath);

      await readyMessage(client);
      client.destroy();
      await run;

      await expect(readFile(`${logPath}.1`, 'utf8')).resolves.toBe(PREVIOUS_LOG);
      await expect(readFile(logPath, 'utf8')).resolves.toBe('');
    }, RUN_TIMEOUT_MS);
  });
});
