import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startWebServers, stopWebServers } from './web-servers.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import type { RunningServer, StartOutcome } from '../common/server.type.ts';
import { stopServer } from '../data-access/server.process.ts';
import { WEB_SERVER_FACT_STUB } from '../test/stubs/web-server.stub.ts';
import { freePorts } from '../test/utils/static-server.spec.util.ts';

const START_TIMEOUT_MS = 30_000;
const SLOW_STOP_MS = 200;
const STOP_ERROR = 'child error while stopping';

vi.mock(import('../data-access/server.process.ts'), async (importOriginal) => {
  const actual = await importOriginal();
  const stopSpy = vi.fn(actual.stopServer);
  const mocked: typeof actual = { ...actual, stopServer: stopSpy };

  return mocked;
});

/** A server whose child has nothing to do, for cases where `stopServer` is replaced. */
const idleServer = (): RunningServer => {
  const child = spawn(process.execPath, ['-e', ''], { stdio: ['ignore', 'pipe', 'pipe'] });
  const server: RunningServer = { child, fact: WEB_SERVER_FACT_STUB };

  return server;
};

const startsOf = async (packageDir: string): Promise<string> => {
  return readFile(join(packageDir, '.atomizer/starts.log'), 'utf8').catch((): string => '');
};

describe('FEATURE: web servers', (): void => {
  let copy: FixtureCopy;
  let outcome: StartOutcome | undefined;

  beforeEach(async (): Promise<void> => {
    copy = await copyFixture('server-config');
    await mkdir(join(copy.directory, '.atomizer'));
    outcome = undefined;

    const [port, secondPort] = await freePorts(2);

    vi.stubEnv('ATOMIZER_FIXTURE_PORT', String(port));
    vi.stubEnv('ATOMIZER_FIXTURE_PORT2', String(secondPort));
  });

  afterEach(async (): Promise<void> => {
    vi.unstubAllEnvs();

    if (outcome !== undefined) await stopWebServers(outcome.servers);

    await copy.dispose();
  });

  describe('GIVEN a webServer with neither url nor port', (): void => {
    it(
      'WHEN the servers start THEN they fail before anything is spawned',
      async (): Promise<void> => {
        vi.stubEnv('ATOMIZER_FIXTURE_SERVER', 'no-url');

        outcome = await startWebServers(copy.directory, 'playwright.config.ts', new PassThrough());

        expect(outcome.ok).toBe(false);
        expect(outcome).toHaveProperty('message', expect.stringContaining('neither url nor port'));
        expect(outcome.servers).toEqual([]);
        await expect(startsOf(copy.directory)).resolves.toBe('');
      },
      START_TIMEOUT_MS
    );
  });

  describe('GIVEN an array of two webServers, the second with a wait pattern', (): void => {
    it(
      'WHEN the servers start THEN both run and the captured group is in env',
      async (): Promise<void> => {
        vi.stubEnv('ATOMIZER_FIXTURE_SERVER', 'array');

        outcome = await startWebServers(copy.directory, 'playwright.config.ts', new PassThrough());

        const starts = await startsOf(copy.directory);
        const expectedEnv = { ['SECOND_PORT']: process.env['ATOMIZER_FIXTURE_PORT2'] };

        expect(outcome.ok).toBe(true);
        expect(outcome).toHaveProperty('env', expectedEnv);
        expect(outcome.servers).toHaveLength(2);
        expect(starts.trim().split('\n')).toHaveLength(2);
      },
      START_TIMEOUT_MS
    );
  });

  describe('GIVEN two servers whose first stop rejects while the second is slow', (): void => {
    let events: string[];

    beforeEach((): void => {
      events = [];
      vi.mocked(stopServer).mockRejectedValueOnce(new Error(STOP_ERROR));
      vi.mocked(stopServer).mockImplementationOnce(async (): Promise<void> => {
        await sleep(SLOW_STOP_MS);
        events.push('slow server stopped');
      });
    });

    it('WHEN they are stopped THEN the stop rejects only after the slow server has stopped', async (): Promise<void> => {
      const stopping = stopWebServers([idleServer(), idleServer()]);

      await stopping.catch((): number => events.push('stop rejected'));

      expect(events).toEqual(['slow server stopped', 'stop rejected']);
    });

    it('WHEN they are stopped THEN the rejection names the failed stop', async (): Promise<void> => {
      const stopping = stopWebServers([idleServer(), idleServer()]);

      await expect(stopping).rejects.toThrow(STOP_ERROR);
    });
  });

  describe('GIVEN a Playwright config that cannot be listed', (): void => {
    it(
      'WHEN the servers start THEN they fail with the listing error',
      async (): Promise<void> => {
        outcome = await startWebServers(copy.directory, 'missing.config.ts', new PassThrough());

        expect(outcome.ok).toBe(false);
        expect(outcome).toHaveProperty('message', expect.stringContaining('playwright test --list failed'));
      },
      START_TIMEOUT_MS
    );
  });
});
