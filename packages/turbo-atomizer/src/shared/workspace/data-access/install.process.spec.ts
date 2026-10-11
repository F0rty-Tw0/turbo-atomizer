import { readFile, realpath } from 'node:fs/promises';
import { delimiter } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runInstall } from './install.process.ts';
import { InstallFailedException } from '../common/install-failed.exception.ts';
import type { StubCommand } from '../test/common/workspace.type.ts';
import { stubCommand } from '../test/utils/stub-command.spec.util.ts';

describe('FEATURE: install process', (): void => {
  let stub: StubCommand;

  afterEach(async (): Promise<void> => {
    vi.unstubAllEnvs();
    await stub.dispose();
  });

  describe('GIVEN a pnpm on PATH that succeeds', (): void => {
    it('WHEN install runs THEN pnpm install runs once in the root', async (): Promise<void> => {
      stub = await stubCommand('pnpm', 0);
      vi.stubEnv('PATH', `${stub.directory}${delimiter}${process.env['PATH'] ?? ''}`);
      const root = await realpath(stub.directory);

      await runInstall(root, 'pnpm');

      const calls = await readFile(stub.callsFile, 'utf8');

      expect(calls.trim()).toBe(`${root} install`);
    });
  });

  describe('GIVEN an npm on PATH that fails', (): void => {
    it('WHEN install runs THEN it rejects with InstallFailedException carrying the exit code', async (): Promise<void> => {
      stub = await stubCommand('npm', 3);
      vi.stubEnv('PATH', `${stub.directory}${delimiter}${process.env['PATH'] ?? ''}`);

      const installing = runInstall(stub.directory, 'npm');

      await expect(installing).rejects.toMatchObject({ name: 'InstallFailedException', command: 'npm install', exitCode: 3 });
    });
  });

  describe('GIVEN a PATH without the package manager', (): void => {
    it('WHEN install runs THEN it rejects with InstallFailedException', async (): Promise<void> => {
      stub = await stubCommand('npm', 0);
      vi.stubEnv('PATH', stub.directory);

      const installing = runInstall(stub.directory, 'pnpm');

      await expect(installing).rejects.toBeInstanceOf(InstallFailedException);
    });
  });
});
