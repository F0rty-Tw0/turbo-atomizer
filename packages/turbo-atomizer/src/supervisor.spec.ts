import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { waitUntil } from './server/test/utils/static-server.spec.util.ts';
import { killSupervisor } from './server/test/utils/supervisor-cleanup.spec.util.ts';

const execFileAsync = promisify(execFile);

const SUPERVISOR_ENTRY = join(import.meta.dirname, 'supervisor.ts');
const LOG_WAIT_MS = 10_000;
const CASE_TIMEOUT_MS = 20_000;

const readLog = (logPath: string): string => {
  try {
    return readFileSync(logPath, 'utf8');
  } catch {
    return '';
  }
};

describe('FEATURE: supervisor entry', (): void => {
  let packageDir: string;

  beforeEach(async (): Promise<void> => {
    packageDir = await mkdtemp(join(tmpdir(), 'atomizer-entry-'));
  });

  afterEach(async (): Promise<void> => {
    await killSupervisor(packageDir);
    await rm(packageDir, { force: true, recursive: true });
  });

  describe('GIVEN the --spawn launcher run that WMI starts on Windows', (): void => {
    it(
      'WHEN it runs THEN it exits at once and the supervisor it spawned listens with its output in server.log',
      async (): Promise<void> => {
        const logPath = join(packageDir, '.atomizer/server.log');

        await execFileAsync(process.execPath, [SUPERVISOR_ENTRY, '--spawn', packageDir, 'playwright.config.ts']);

        const isListening = await waitUntil((): boolean => readLog(logPath).includes(' listening on '), LOG_WAIT_MS);

        expect(isListening, readLog(logPath)).toBe(true);
      },
      CASE_TIMEOUT_MS
    );
  });

  describe('GIVEN no package dir', (): void => {
    it('WHEN the entry runs THEN it prints the usage with --spawn and exits 2', async (): Promise<void> => {
      const run = execFileAsync(process.execPath, [SUPERVISOR_ENTRY, '--spawn']);

      await expect(run).rejects.toMatchObject({
        code: 2,
        stderr: 'Usage: supervisor [--spawn] <package dir> <playwright config file>\n'
      });
    });
  });
});
