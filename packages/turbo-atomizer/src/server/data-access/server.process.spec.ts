import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { spawnServer, stopServer } from './server.process.ts';
import type { WebServerFact } from '../../shared/atomizer/common/atomizer.type.ts';
import { fixtureDirectory } from '../../test/utils/fixture-copy.spec.util.ts';
import type { RunningServer, ServerChild } from '../common/server.type.ts';
import { WEB_SERVER_FACT_STUB } from '../test/stubs/web-server.stub.ts';
import { isAlive, waitUntil } from '../test/utils/static-server.spec.util.ts';

const REAP_MS = 2000;
const IGNORE_SIGTERM = `node -e "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); console.log('up')"`;
const REPORT_SIGINT = `node -e "process.on('SIGINT', () => { console.log('got SIGINT'); process.exit(0); }); setInterval(() => {}, 1000); console.log('up')"`;

const firstLine = async (child: ServerChild): Promise<string> => {
  const lines = createInterface({ input: child.stdout });
  const event = await once(lines, 'line');
  const line: unknown = event[0];

  return String(line);
};

const stdoutOf = async (child: ServerChild): Promise<string> => {
  const chunks: string[] = [];

  child.stdout.on('data', (chunk: Buffer): number => chunks.push(chunk.toString()));

  return new Promise((resolve): void => {
    child.once('close', (): void => resolve(chunks.join('')));
  });
};

const running = (child: ServerChild, fact: WebServerFact): RunningServer => {
  const server: RunningServer = { child, fact };

  return server;
};

describe('FEATURE: server process', (): void => {
  let directory: string;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'atomizer-process-'));
  });

  afterEach(async (): Promise<void> => {
    await rm(directory, { force: true, recursive: true });
  });

  describe('GIVEN a command printing its cwd and env', (): void => {
    it('WHEN it is spawned THEN it runs through the shell in the cwd with exactly the env given', async (): Promise<void> => {
      const env = { PATH: process.env['PATH'] ?? '', ['PROBE_VALUE']: 'from-env' };
      const command = `node -e "console.log(process.cwd() + ' ' + process.env.PROBE_VALUE + ' ' + process.env.HOME)"`;

      const output = stdoutOf(spawnServer(command, directory, env));

      await expect(output).resolves.toBe(`${directory} from-env undefined\n`);
    });
  });

  describe('GIVEN a shell command whose server runs as a grandchild', (): void => {
    it('WHEN the server is stopped THEN the whole process group is gone', async (): Promise<void> => {
      const script = join(fixtureDirectory('server-config'), 'static-server.mjs');
      const startsLog = join(directory, 'starts.log');
      const command = `node ${script} --starts-log ${startsLog} & wait`;
      const child = spawnServer(command, directory, { PATH: process.env['PATH'] ?? '' });

      await firstLine(child);

      const grandchildPid = Number(await readFile(startsLog, 'utf8'));

      await stopServer(running(child, WEB_SERVER_FACT_STUB));

      const isGone = await waitUntil((): boolean => !isAlive(grandchildPid), REAP_MS);

      expect(isGone).toBe(true);
    });
  });

  describe('GIVEN a server that ignores SIGTERM', (): void => {
    it('WHEN it is stopped with a short graceful timeout THEN it is killed', async (): Promise<void> => {
      const gracefulShutdown = { signal: 'SIGTERM' as const, timeout: 200 };
      const fact: WebServerFact = { ...WEB_SERVER_FACT_STUB, gracefulShutdown };
      const child = spawnServer(IGNORE_SIGTERM, directory, { PATH: process.env['PATH'] ?? '' });

      await firstLine(child);
      await stopServer(running(child, fact));

      const isGone = await waitUntil((): boolean => !isAlive(child.pid ?? 0), REAP_MS);

      expect(isGone).toBe(true);
    });
  });

  describe('GIVEN a gracefulShutdown signal of SIGINT', (): void => {
    it('WHEN the server is stopped THEN it receives SIGINT', async (): Promise<void> => {
      const gracefulShutdown = { signal: 'SIGINT' as const, timeout: 2000 };
      const fact: WebServerFact = { ...WEB_SERVER_FACT_STUB, gracefulShutdown };
      const child = spawnServer(REPORT_SIGINT, directory, { PATH: process.env['PATH'] ?? '' });
      const output = stdoutOf(child);

      await firstLine(child);
      await stopServer(running(child, fact));

      await expect(output).resolves.toContain('got SIGINT');
    });
  });
});
