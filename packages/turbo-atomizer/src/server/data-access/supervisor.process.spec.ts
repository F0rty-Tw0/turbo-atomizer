import { readFileSync } from 'node:fs';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { rotateServerLog, spawnSupervisor } from './supervisor.process.ts';
import { waitUntil } from '../test/utils/static-server.spec.util.ts';

const ECHO_SUPERVISOR = join(import.meta.dirname, '../test/fixtures/echo-supervisor.mjs');
const LOG_WAIT_MS = 5000;

const readLog = (logPath: string): string => {
  try {
    return readFileSync(logPath, 'utf8');
  } catch {
    return '';
  }
};

describe('FEATURE: supervisor process', (): void => {
  let packageDir: string;
  let logPath: string;

  beforeEach(async (): Promise<void> => {
    packageDir = await mkdtemp(join(tmpdir(), 'atomizer-supervisor-'));
    logPath = join(packageDir, '.atomizer/server.log');
  });

  afterEach(async (): Promise<void> => {
    await rm(packageDir, { force: true, recursive: true });
  });

  describe('GIVEN a package dir without .atomizer/', (): void => {
    it('WHEN the supervisor is spawned THEN .atomizer/server.log is created and receives its output', async (): Promise<void> => {
      const expected = JSON.stringify({ args: [packageDir, 'playwright.config.ts'], cwd: packageDir });

      await spawnSupervisor(ECHO_SUPERVISOR, packageDir, 'playwright.config.ts');

      const hasOutput = await waitUntil((): boolean => readLog(logPath).includes('args'), LOG_WAIT_MS);

      expect(hasOutput).toBe(true);
      expect(readLog(logPath)).toBe(`${expected}\n`);
    });
  });

  describe('GIVEN an existing server.log', (): void => {
    it('WHEN the supervisor is spawned THEN its output is appended', async (): Promise<void> => {
      await mkdir(join(packageDir, '.atomizer'));
      await writeFile(logPath, 'previous run\n');

      await spawnSupervisor(ECHO_SUPERVISOR, packageDir, 'playwright.config.ts');

      const hasOutput = await waitUntil((): boolean => readLog(logPath).includes('args'), LOG_WAIT_MS);

      expect(hasOutput).toBe(true);
      expect(readLog(logPath)).toMatch(/^previous run\n\{"args"/);
    });
  });

  describe('GIVEN a package dir without server.log', (): void => {
    it('WHEN the log is rotated THEN nothing is created', async (): Promise<void> => {
      await rotateServerLog(packageDir);

      await expect(access(`${logPath}.1`)).rejects.toThrow('ENOENT');
    });
  });
});
