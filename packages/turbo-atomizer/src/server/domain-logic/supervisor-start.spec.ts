import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startSupervisor } from './supervisor-start.ts';
import { waitUntil } from '../test/utils/static-server.spec.util.ts';

const IS_WINDOWS = process.platform === 'win32';
const ECHO_SUPERVISOR = join(import.meta.dirname, '../test/fixtures/echo-supervisor.mjs');
const LOG_WAIT_MS = 5000;

const readLog = (logPath: string): string => {
  try {
    return readFileSync(logPath, 'utf8');
  } catch {
    return '';
  }
};

describe('FEATURE: supervisor start', (): void => {
  let packageDir: string;

  beforeEach(async (): Promise<void> => {
    packageDir = await mkdtemp(join(tmpdir(), 'atomizer-start-'));
  });

  afterEach(async (): Promise<void> => {
    await rm(packageDir, { force: true, recursive: true });
  });

  describe.skipIf(IS_WINDOWS)('GIVEN a POSIX machine, where no task job kills detached children', (): void => {
    it('WHEN the supervisor is started THEN it is spawned directly with its output in server.log', async (): Promise<void> => {
      const logPath = join(packageDir, '.atomizer/server.log');
      const expected = JSON.stringify({ args: [packageDir, 'playwright.config.ts'], cwd: packageDir });

      await startSupervisor(ECHO_SUPERVISOR, packageDir, 'playwright.config.ts');

      const hasOutput = await waitUntil((): boolean => readLog(logPath).includes('args'), LOG_WAIT_MS);

      expect(hasOutput).toBe(true);
      expect(readLog(logPath)).toBe(`${expected}\n`);
    });
  });
});
