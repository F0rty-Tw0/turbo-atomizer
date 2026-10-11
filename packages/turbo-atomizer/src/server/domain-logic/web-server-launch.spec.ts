import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { launchWebServer } from './web-server-launch.ts';
import type { WebServerFact } from '../../shared/atomizer/common/atomizer.type.ts';
import { fixtureDirectory } from '../../test/utils/fixture-copy.spec.util.ts';
import type { LaunchOutcome } from '../common/server.type.ts';
import { stopServer } from '../data-access/server.process.ts';
import type { StaticServer } from '../test/common/server.type.ts';
import { WEB_SERVER_FACT_STUB } from '../test/stubs/web-server.stub.ts';
import { freePort, startStaticServer } from '../test/utils/static-server.spec.util.ts';

const configDir = fixtureDirectory('server-config');
const env = { PATH: process.env['PATH'] ?? '' };

const stopLaunched = async (outcome: LaunchOutcome | undefined): Promise<void> => {
  if (outcome?.server !== undefined) await stopServer(outcome.server);
};

describe('FEATURE: web server launch', (): void => {
  let directory: string;
  let startsLog: string;
  let outcome: LaunchOutcome | undefined;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'atomizer-launch-'));
    startsLog = join(directory, 'starts.log');
    outcome = undefined;
  });

  afterEach(async (): Promise<void> => {
    await stopLaunched(outcome);
    await rm(directory, { force: true, recursive: true });
  });

  describe('GIVEN a server already answering on the url', (): void => {
    let existing: StaticServer;

    beforeEach(async (): Promise<void> => {
      existing = await startStaticServer([]);
    });

    afterEach(async (): Promise<void> => {
      await existing.stop();
    });

    it('WHEN it is launched THEN it is reused and nothing is spawned', async (): Promise<void> => {
      const url = `http://127.0.0.1:${String(existing.port)}/index.html`;
      const fact: WebServerFact = { command: `node static-server.mjs --starts-log ${startsLog}`, url };

      outcome = await launchWebServer(fact, configDir, env, new PassThrough());

      expect(outcome).toEqual({ ok: true, env: {}, server: undefined });
      await expect(readFile(startsLog, 'utf8')).rejects.toThrow('ENOENT');
    });
  });

  describe('GIVEN a command that serves the url after a delay', (): void => {
    it('WHEN it is launched THEN it is spawned in the config dir and ready', async (): Promise<void> => {
      const port = await freePort();
      const url = `http://127.0.0.1:${String(port)}/index.html`;
      const fact: WebServerFact = { command: `node static-server.mjs --port ${String(port)} --delay 200`, url };

      outcome = await launchWebServer(fact, configDir, env, new PassThrough());

      expect(outcome.ok).toBe(true);
      expect(outcome.server?.child.pid).toBeTypeOf('number');
    });
  });

  describe('GIVEN a wait pattern with a named group', (): void => {
    it('WHEN the server prints it THEN the group is captured as an upper-cased env entry', async (): Promise<void> => {
      const port = await freePort();
      const stdout = { source: 'ready on (?<served_port>\\d+)', flags: '' };
      const wait = { stdout };
      const expectedEnv = { ['SERVED_PORT']: String(port) };
      const fact: WebServerFact = { command: `node static-server.mjs --port ${String(port)}`, port, wait };

      outcome = await launchWebServer(fact, configDir, env, new PassThrough());

      expect(outcome.ok).toBe(true);
      expect(outcome).toHaveProperty('env', expectedEnv);
    });
  });

  describe('GIVEN a command that exits 1', (): void => {
    it('WHEN it is launched THEN it fails with the exit code and the log tail', async (): Promise<void> => {
      const port = await freePort();
      const command = `node -e "console.error('launch failed loudly'); process.exit(1)"`;
      const fact: WebServerFact = { command, port };

      outcome = await launchWebServer(fact, configDir, env, new PassThrough());

      expect(outcome.ok).toBe(false);
      expect(outcome).toHaveProperty('message', expect.stringContaining('code 1'));
      expect(outcome).toHaveProperty('logTail', expect.stringContaining('launch failed loudly'));
    });
  });

  describe('GIVEN a command that never serves its port', (): void => {
    it('WHEN the timeout passes THEN it fails as timed out and the server is handed back for stopping', async (): Promise<void> => {
      const port = await freePort();
      const fact: WebServerFact = { ...WEB_SERVER_FACT_STUB, command: 'node -e "setInterval(() => {}, 1000)"', port, timeout: 300 };

      outcome = await launchWebServer(fact, configDir, env, new PassThrough());

      expect(outcome.ok).toBe(false);
      expect(outcome).toHaveProperty('message', expect.stringContaining('300 ms'));
      expect(outcome.server).toBeDefined();
    });
  });
});
