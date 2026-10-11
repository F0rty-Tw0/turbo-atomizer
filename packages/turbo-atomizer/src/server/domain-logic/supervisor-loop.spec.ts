import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SupervisorLoop } from './supervisor-loop.ts';
import { startWebServers, stopWebServers } from './web-servers.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';
import { NONCE_TIMEOUT_MS, STARTING_INTERVAL_MS, STARTING_MESSAGE } from '../common/server.const.ts';
import type { RunningServer, StartOutcome, SupervisorLoopOptions } from '../common/server.type.ts';
import { connectSocket, onVerifiedMessages } from '../data-access/rendezvous-client.socket.ts';
import { stopServer } from '../data-access/server.process.ts';
import { TOKEN_STUB } from '../test/stubs/rendezvous-token.stub.ts';
import { freePort, isAlive, waitUntil } from '../test/utils/static-server.spec.util.ts';

const IDLE_MS = 300;
const LOOP_TIMEOUT_MS = 30_000;
const MESSAGE_WAIT_MS = 1000;

vi.mock(import('./web-servers.ts'), async (importOriginal) => {
  const actual = await importOriginal();
  const startSpy = vi.fn(actual.startWebServers);
  const stopSpy = vi.fn(actual.stopWebServers);
  const mocked: typeof actual = { ...actual, startWebServers: startSpy, stopWebServers: stopSpy };

  return mocked;
});

/** Stops the servers for real, then rejects, as `once(child, 'close')` does when a child emits `error` mid-stop. */
const stopThenReject = async (servers: RunningServer[]): Promise<void> => {
  await Promise.all(servers.map(stopServer));

  throw new Error('child error while stopping');
};

/** A start that never settles, so the loop stays in its starting phase. */
const neverStart = async (): Promise<StartOutcome> => new Promise((): undefined => undefined);

const nextTurn = async (): Promise<void> => new Promise((resolve): void => void setImmediate(resolve));

/** Yields real event-loop turns (fake timers leave `setImmediate` alone) until `holds` is true. */
const until = async (holds: () => boolean): Promise<void> => {
  while (!holds()) await nextTurn();
};

const onServerMessages = (socket: Socket, onMessage: (message: ServerMessage) => void): void => {
  onVerifiedMessages(socket, TOKEN_STUB, { onMessage, onRefused: (): void => void socket.destroy() });
};

const collectText = (log: PassThrough): (() => string) => {
  let text = '';

  log.on('data', (chunk: Buffer): void => {
    text += chunk.toString();
  });

  return (): string => text;
};

const collectMessages = (socket: Socket): ServerMessage[] => {
  const messages: ServerMessage[] = [];

  onServerMessages(socket, (message: ServerMessage): number => messages.push(message));

  return messages;
};

const messagesUntilAnswer = async (socket: Socket): Promise<ServerMessage[]> => {
  const messages: ServerMessage[] = [];

  return new Promise((resolve): void => {
    const onMessage = (message: ServerMessage): void => {
      messages.push(message);

      if (message.state !== 'starting') resolve(messages);
    };

    onServerMessages(socket, onMessage);
  });
};

const serverPid = async (packageDir: string): Promise<number> => {
  const starts = await readFile(join(packageDir, '.atomizer/starts.log'), 'utf8');

  return Number(starts.trim());
};

describe('FEATURE: supervisor loop', (): void => {
  let copy: FixtureCopy;
  let listener: Server;
  let socketPath: string;

  const listen = async (options: SupervisorLoopOptions): Promise<SupervisorLoop> => {
    const loop = new SupervisorLoop(options);

    listener = createServer(loop.onConnection);
    listener.listen(socketPath);
    await once(listener, 'listening');
    loop.start();

    return loop;
  };

  beforeEach(async (): Promise<void> => {
    copy = await copyFixture('server-config');
    await mkdir(join(copy.directory, '.atomizer'));
    // Unix socket paths cap at 104-108 bytes, so the socket lives in tmpdir, not the (possibly deep) fixture copy.
    socketPath = join(tmpdir(), `ta-loop-${randomUUID().slice(0, 8)}.sock`);

    const port = await freePort();

    vi.stubEnv('ATOMIZER_FIXTURE_PORT', String(port));
  });

  afterEach(async (): Promise<void> => {
    vi.unstubAllEnvs();
    listener.close();
    await copy.dispose();
  });

  describe('GIVEN a package whose webServer starts', (): void => {
    let options: SupervisorLoopOptions;

    beforeEach((): void => {
      options = {
        packageDir: copy.directory,
        configFile: 'playwright.config.ts',
        idleMs: IDLE_MS,
        log: new PassThrough(),
        startupFailure: undefined,
        token: TOKEN_STUB
      };
    });

    it(
      'WHEN a client connects THEN it hears starting, then ready',
      async (): Promise<void> => {
        const loop = await listen(options);
        const client = await connectSocket(socketPath);

        const messages = await messagesUntilAnswer(client);

        client.destroy();
        await loop.done;
        expect(messages.at(0)).toEqual({ state: 'starting' });
        expect(messages.at(-1)).toEqual({ state: 'ready', env: {} });
      },
      LOOP_TIMEOUT_MS
    );

    it(
      'WHEN the last client leaves THEN the loop stops the server after idleMs and finishes',
      async (): Promise<void> => {
        const loop = await listen(options);
        const client = await connectSocket(socketPath);

        await messagesUntilAnswer(client);

        const pid = await serverPid(copy.directory);

        client.destroy();
        await loop.done;

        const isGone = await waitUntil((): boolean => !isAlive(pid), IDLE_MS);

        expect(isGone).toBe(true);
      },
      LOOP_TIMEOUT_MS
    );

    it(
      'WHEN the server dies after ready THEN the leased client hears failed and a new client is answered failed',
      async (): Promise<void> => {
        const loop = await listen(options);
        const leased = await connectSocket(socketPath);
        const heard = collectMessages(leased);

        await waitUntil((): boolean => heard.some((message): boolean => message.state === 'ready'), LOOP_TIMEOUT_MS);

        const pid = await serverPid(copy.directory);

        process.kill(pid, 'SIGKILL');
        await waitUntil((): boolean => heard.some((message): boolean => message.state === 'failed'), LOOP_TIMEOUT_MS);

        const late = await connectSocket(socketPath);
        const messages = await messagesUntilAnswer(late);

        leased.destroy();
        late.destroy();
        await loop.done;
        expect(messages.at(-1)?.state).toBe('failed');
        expect(messages.at(-1)).toHaveProperty('message', expect.stringContaining('after it was ready'));
      },
      LOOP_TIMEOUT_MS
    );

    it(
      'WHEN stopping the servers rejects THEN the loop logs the error and still finishes',
      async (): Promise<void> => {
        const log = new PassThrough();
        const logged = collectText(log);
        const loop = await listen({ ...options, log });
        const client = await connectSocket(socketPath);

        vi.mocked(stopWebServers).mockImplementationOnce(stopThenReject);
        await messagesUntilAnswer(client);
        client.destroy();
        await loop.done;

        expect(logged()).toContain('child error while stopping');
      },
      LOOP_TIMEOUT_MS
    );
  });

  describe('GIVEN a webServer that is still starting', (): void => {
    beforeEach((): void => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      vi.mocked(startWebServers).mockImplementationOnce(neverStart);
    });

    afterEach((): void => {
      vi.useRealTimers();
    });

    it('WHEN 5 s pass THEN a connected client hears starting again', async (): Promise<void> => {
      const options: SupervisorLoopOptions = {
        packageDir: copy.directory,
        configFile: 'playwright.config.ts',
        idleMs: IDLE_MS,
        log: new PassThrough(),
        startupFailure: undefined,
        token: TOKEN_STUB
      };

      await listen(options);

      const client = await connectSocket(socketPath);
      const messages = collectMessages(client);

      await waitUntil((): boolean => messages.length === 1, MESSAGE_WAIT_MS);
      await vi.advanceTimersByTimeAsync(STARTING_INTERVAL_MS);
      await waitUntil((): boolean => messages.length === 2, MESSAGE_WAIT_MS);

      client.destroy();
      expect(messages).toEqual([STARTING_MESSAGE, STARTING_MESSAGE]);
    });
  });

  describe('GIVEN a client that connects but never sends a nonce', (): void => {
    beforeEach((): void => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      vi.mocked(startWebServers).mockImplementationOnce(neverStart);
    });

    afterEach((): void => {
      vi.useRealTimers();
    });

    it('WHEN 5 s pass THEN the loop drops it without a reply', async (): Promise<void> => {
      const options: SupervisorLoopOptions = {
        packageDir: copy.directory,
        configFile: 'playwright.config.ts',
        idleMs: IDLE_MS,
        log: new PassThrough(),
        startupFailure: undefined,
        token: TOKEN_STUB
      };
      let received = '';

      await listen(options);

      const client = await connectSocket(socketPath);
      const closed = once(client, 'close');

      client.on('data', (chunk: Buffer): void => void (received += chunk.toString()));
      await until((): boolean => vi.getTimerCount() > 0);
      await vi.advanceTimersByTimeAsync(NONCE_TIMEOUT_MS);
      await closed;

      expect(received).toBe('');
    });
  });

  describe('GIVEN a startup failure', (): void => {
    it(
      'WHEN a client connects THEN it hears failed with that message and the loop finishes',
      async (): Promise<void> => {
        const options: SupervisorLoopOptions = {
          packageDir: copy.directory,
          configFile: 'playwright.config.ts',
          idleMs: IDLE_MS,
          log: new PassThrough(),
          startupFailure: 'invalid turbo-atomizer.json',
          token: TOKEN_STUB
        };
        const loop = await listen(options);
        const client = await connectSocket(socketPath);

        const messages = await messagesUntilAnswer(client);

        await loop.done;
        expect(messages.at(-1)).toEqual({ state: 'failed', message: 'invalid turbo-atomizer.json', logTail: '' });
      },
      LOOP_TIMEOUT_MS
    );
  });
});
