import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ownRendezvousPath } from './rendezvous.ts';
import { ensureServer } from './server-lease.ts';
import type { ServerLease } from '../../shared/server/common/server-lease.type.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import { ServerFailedException } from '../common/server-failed.exception.ts';
import { CLIENT_SILENCE_MS, LEASE_ATTEMPTS, PROBE_BACKOFF_MS } from '../common/server.const.ts';
import { acquireLock, releaseLock } from '../data-access/rendezvous.lock.ts';
import { refuseForeignSocket } from '../data-access/rendezvous.path.ts';
import type { StaticServer } from '../test/common/server.type.ts';
import { createStaleSocket } from '../test/utils/stale-socket.spec.util.ts';
import { exitedPid, freePort, isAlive, startStaticServer, waitUntil } from '../test/utils/static-server.spec.util.ts';
import { killSupervisor, startedPids } from '../test/utils/supervisor-cleanup.spec.util.ts';
import { lockPathOf } from '../utils/rendezvous-path.util.ts';

const SUPERVISOR_PATH = join(import.meta.dirname, '../../supervisor.ts');
const CONFIG_FILE = 'playwright.config.ts';
const IDLE_MS = 500;
const STOP_GRACE_MS = 6000;
const CASE_TIMEOUT_MS = 30_000;
const CONCURRENT_EXECS = 10;
const LATE_RELEASE_MS = 500;

const MIN_LEASE_BACKOFF_MS = PROBE_BACKOFF_MS.slice(0, LEASE_ATTEMPTS - 1).reduce((sum: number, delay: number): number => sum + delay, 0);

const spanOf = (times: number[]): number => Math.max(...times) - Math.min(...times);

const STARTING_LINE = '{"state":"starting"}\n';
const READY_LINE = '{"state":"ready","env":{"PORT":"1"}}\n';
const HEARTBEAT_AT_MS = 25_000;

vi.mock(import('../data-access/rendezvous.path.ts'), async (importOriginal) => {
  const actual = await importOriginal();
  const refuseSpy = vi.fn(actual.refuseForeignSocket);
  const mocked: typeof actual = { ...actual, refuseForeignSocket: refuseSpy };

  return mocked;
});

const nextTurn = async (): Promise<void> => new Promise((resolve): void => void setImmediate(resolve));

/** Yields real event-loop turns (fake timers leave `setImmediate` alone) until `holds` is true. */
const until = async (holds: () => boolean): Promise<void> => {
  while (!holds()) await nextTurn();
};

/** 'pending' until `request` settles, then 'ready' or 'rejected'; marks the rejection handled. */
const stateOf = (request: Promise<ServerLease>): (() => string) => {
  let state = 'pending';

  request.then(
    (): void => void (state = 'ready'),
    (): void => void (state = 'rejected')
  );

  return (): string => state;
};

const lease = async (packageDir: string): Promise<ServerLease> => ensureServer(packageDir, CONFIG_FILE, SUPERVISOR_PATH);

const releaseAll = (leases: ServerLease[]): void => {
  for (const held of leases) held.release();
};

describe('FEATURE: server lease', (): void => {
  let copy: FixtureCopy;
  let port: number;
  let socketPath: string;
  let lockPath: string;

  const supervisorExited = async (): Promise<boolean> => waitUntil((): boolean => !existsSync(lockPath), IDLE_MS + STOP_GRACE_MS);

  beforeEach(async (): Promise<void> => {
    copy = await copyFixture('server-config');
    port = await freePort();
    socketPath = ownRendezvousPath(copy.directory);
    lockPath = lockPathOf(socketPath);
    await mkdir(dirname(socketPath), { recursive: true, mode: 0o700 });
    vi.stubEnv('ATOMIZER_FIXTURE_PORT', String(port));
    vi.stubEnv('ATOMIZER_FIXTURE_SERVER', 'ok');
  });

  afterEach(async (): Promise<void> => {
    vi.unstubAllEnvs();
    await killSupervisor(copy.directory);
    await copy.dispose();
  });

  describe('GIVEN a fresh copy without .atomizer/', (): void => {
    it('WHEN one exec leases the server THEN .atomizer/server.log is created and the lease is ready', async (): Promise<void> => {
      const held = await lease(copy.directory);

      held.release();
      expect(held.env).toEqual({});
      expect(existsSync(join(copy.directory, '.atomizer/server.log'))).toBe(true);
    }, CASE_TIMEOUT_MS);

    it('WHEN 10 execs lease at once THEN the server process starts exactly once', async (): Promise<void> => {
      const requests = Array.from({ length: CONCURRENT_EXECS }, async (): Promise<ServerLease> => lease(copy.directory));

      const leases = await Promise.all(requests);

      releaseAll(leases);
      await expect(startedPids(copy.directory)).resolves.toHaveLength(1);
    }, CASE_TIMEOUT_MS);

    it('WHEN every lease is released THEN the server pid is gone within idleMs + 6 s', async (): Promise<void> => {
      const leases = await Promise.all([lease(copy.directory), lease(copy.directory)]);
      const [pid = 0] = await startedPids(copy.directory);

      releaseAll(leases);

      const isGone = await waitUntil((): boolean => !isAlive(pid), IDLE_MS + STOP_GRACE_MS);

      expect(isGone).toBe(true);
      await expect(supervisorExited()).resolves.toBe(true);
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a server already running on the port', (): void => {
    let existing: StaticServer;

    beforeEach(async (): Promise<void> => {
      existing = await startStaticServer(['--port', String(port)]);
    });

    afterEach(async (): Promise<void> => {
      await existing.stop();
    });

    it('WHEN it is leased and released THEN it is reused and still alive after the supervisor exits', async (): Promise<void> => {
      const held = await lease(copy.directory);

      held.release();

      const hasExited = await supervisorExited();

      expect(hasExited).toBe(true);
      await expect(startedPids(copy.directory)).resolves.toEqual([]);
      expect(isAlive(existing.pid)).toBe(true);
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a webServer command that exits 1', (): void => {
    it('WHEN 3 execs lease at once THEN every one rejects with the log tail', async (): Promise<void> => {
      vi.stubEnv('ATOMIZER_FIXTURE_SERVER', 'exit1');

      const results = await Promise.allSettled([lease(copy.directory), lease(copy.directory), lease(copy.directory)]);
      const reasons = results.map((result): unknown => (result.status === 'rejected' ? result.reason : undefined));

      for (const reason of reasons) {
        expect(reason).toBeInstanceOf(ServerFailedException);
        expect(reason).toHaveProperty('logTail', expect.stringContaining('fixture server failed'));
      }
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a webServer with neither url nor port', (): void => {
    it('WHEN an exec leases it THEN it rejects before any server is spawned', async (): Promise<void> => {
      vi.stubEnv('ATOMIZER_FIXTURE_SERVER', 'no-url');

      const request = lease(copy.directory);

      await expect(request).rejects.toThrow('neither url nor port');
      await expect(startedPids(copy.directory)).resolves.toEqual([]);
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a stale lock whose owner pid is dead', (): void => {
    it('WHEN an exec leases the server THEN the lock is taken over and the lease is ready', async (): Promise<void> => {
      const deadPid = await exitedPid();

      await writeFile(lockPath, JSON.stringify({ pid: deadPid, startTime: 'gone' }));

      const held = await lease(copy.directory);

      held.release();
      expect(held.env).toEqual({});
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a live lock with no socket, as an exiting supervisor leaves until it releases the lock', (): void => {
    let release: NodeJS.Timeout;

    beforeEach(async (): Promise<void> => {
      await acquireLock(lockPath);
      release = setTimeout((): void => void releaseLock(lockPath), LATE_RELEASE_MS);
    });

    afterEach(async (): Promise<void> => {
      clearTimeout(release);
      await releaseLock(lockPath);
    });

    it('WHEN an exec leases the server THEN it spawns the supervisor again and the lease is ready', async (): Promise<void> => {
      const held = await lease(copy.directory);

      held.release();
      expect(held.env).toEqual({});
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a stale socket file with no listener', (): void => {
    it('WHEN an exec leases the server THEN the refused socket is replaced and the lease is ready', async (): Promise<void> => {
      await createStaleSocket(socketPath);

      const held = await lease(copy.directory);

      held.release();
      expect(held.env).toEqual({});
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a per-user rendezvous dir other users can enter', (): void => {
    let sharedTmp: string;

    beforeEach(async (): Promise<void> => {
      sharedTmp = await mkdtemp(join(tmpdir(), 'atomizer-shared-'));
      vi.stubEnv('TMPDIR', sharedTmp);

      const userDir = dirname(ownRendezvousPath(copy.directory));

      await mkdir(userDir);
      await chmod(userDir, 0o755);
    });

    afterEach(async (): Promise<void> => {
      await rm(sharedTmp, { force: true, recursive: true });
    });

    it('WHEN an exec leases the server THEN it rejects naming the dir and spawns no supervisor', async (): Promise<void> => {
      const request = lease(copy.directory);

      await expect(request).rejects.toThrow('with mode 0700');
      expect(existsSync(join(copy.directory, '.atomizer/server.log'))).toBe(false);
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a supervisor that hangs up on every connection', (): void => {
    let hangingUp: Server;
    let connectedAt: number[];

    beforeEach(async (): Promise<void> => {
      connectedAt = [];
      hangingUp = createServer((socket: Socket): void => {
        connectedAt.push(Date.now());
        socket.destroy();
      });
      hangingUp.listen(socketPath);
      await once(hangingUp, 'listening');
    });

    afterEach(async (): Promise<void> => {
      hangingUp.close();
      await once(hangingUp, 'close');
    });

    it('WHEN an exec leases the server THEN it backs off between its attempts before rejecting', async (): Promise<void> => {
      await expect(lease(copy.directory)).rejects.toThrow('closed the connection before answering');

      expect(connectedAt).toHaveLength(LEASE_ATTEMPTS);
      expect(spanOf(connectedAt)).toBeGreaterThanOrEqual(MIN_LEASE_BACKOFF_MS);
    }, CASE_TIMEOUT_MS);

    it('WHEN its socket belongs to another uid THEN the lease rejects before any connect', async (): Promise<void> => {
      vi.mocked(refuseForeignSocket).mockRejectedValueOnce(new ServerFailedException(`${socketPath} is owned by uid 0`, ''));

      await expect(lease(copy.directory)).rejects.toThrow('is owned by uid 0');

      expect(connectedAt).toEqual([]);
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a supervisor that hangs up on the first connection and answers ready on the next', (): void => {
    let flaky: Server;

    beforeEach(async (): Promise<void> => {
      let connections = 0;

      flaky = createServer((socket: Socket): void => {
        connections += 1;

        if (connections === 1) return void socket.destroy();

        socket.write(READY_LINE);
      });
      flaky.listen(socketPath);
      await once(flaky, 'listening');
    });

    afterEach(async (): Promise<void> => {
      flaky.close();
      await once(flaky, 'close');
    });

    it('WHEN an exec leases the server THEN its second attempt is ready', async (): Promise<void> => {
      const held = await lease(copy.directory);

      held.release();
      expect(held.env).toEqual({ PORT: '1' });
    }, CASE_TIMEOUT_MS);
  });

  describe('GIVEN a supervisor that accepts and only writes when told', (): void => {
    let quiet: Server;
    let served: Socket[];
    let cleared: () => number;

    beforeEach(async (): Promise<void> => {
      served = [];
      quiet = createServer((socket: Socket): number => served.push(socket));
      quiet.listen(socketPath);
      await once(quiet, 'listening');
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

      cleared = (): number => clearSpy.mock.calls.length;
    });

    afterEach(async (): Promise<void> => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      quiet.close();
      await once(quiet, 'close');
    });

    it('WHEN nothing arrives for 30 s THEN the lease rejects as silent, and not a moment before', async (): Promise<void> => {
      const request = lease(copy.directory);
      const state = stateOf(request);

      await until((): boolean => vi.getTimerCount() > 0);
      await vi.advanceTimersByTimeAsync(CLIENT_SILENCE_MS - 1);

      const before = state();

      await vi.advanceTimersByTimeAsync(1);

      expect(before).toBe('pending');
      await expect(request).rejects.toThrow('the supervisor sent nothing for 30 s');
    }, CASE_TIMEOUT_MS);

    it('WHEN starting arrives at 25 s THEN the lease still waits at 54 s and takes the ready that follows', async (): Promise<void> => {
      const request = lease(copy.directory);
      const state = stateOf(request);

      await until((): boolean => vi.getTimerCount() > 0);
      await vi.advanceTimersByTimeAsync(HEARTBEAT_AT_MS);
      served[0]?.write(STARTING_LINE);
      await until((): boolean => cleared() > 0);
      await vi.advanceTimersByTimeAsync(CLIENT_SILENCE_MS - 1);

      const waiting = state();

      served[0]?.write(READY_LINE);

      const held = await request;

      held.release();
      expect(waiting).toBe('pending');
      expect(held.env).toEqual({ PORT: '1' });
    }, CASE_TIMEOUT_MS);

    it('WHEN starting arrives at 25 s and nothing after THEN the lease rejects 30 s after the starting', async (): Promise<void> => {
      const request = lease(copy.directory);
      const rejection = expect(request).rejects.toThrow('the supervisor sent nothing for 30 s');

      await until((): boolean => vi.getTimerCount() > 0);
      await vi.advanceTimersByTimeAsync(HEARTBEAT_AT_MS);
      served[0]?.write(STARTING_LINE);
      await until((): boolean => cleared() > 0);
      await vi.advanceTimersByTimeAsync(CLIENT_SILENCE_MS);

      await rejection;
    }, CASE_TIMEOUT_MS);
  });
});
