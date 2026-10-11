import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { initHandler } from './init.handler.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture, fixtureDirectory } from '../../test/utils/fixture-copy.spec.util.ts';
import { initPackage } from '../domain-logic/init.ts';
import { initDepsMock } from '../test/mocks/init.mock.ts';

type WriteSpy = MockInstance<NodeJS.WriteStream['write']>;

const LIST_TIMEOUT_MS = 60_000;

describe('FEATURE: init handler', (): void => {
  let stdout: WriteSpy;
  let stderr: WriteSpy;

  beforeEach((): void => {
    stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN a workspace with only a yarn.lock', (): void => {
    it('WHEN init runs THEN the exit code is 1 and stderr names the lockfile', async (): Promise<void> => {
      const packageDir = join(fixtureDirectory('init-yarn'), 'apps/web-e2e');

      const exitCode = await initHandler([packageDir], { cliVersion: '0.1.0' });

      expect(exitCode).toBe(1);
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('found yarn.lock'));
    });
  });

  describe('GIVEN an init-pnpm copy that is already initialized', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
      packageDir = join(copy.directory, 'apps/web-e2e');
      await initPackage({ cliVersion: '0.1.0', packageDir }, initDepsMock());
    }, LIST_TIMEOUT_MS);

    afterEach(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN init runs with the real installed versions THEN the exit code is 0 and nothing changed is printed',
      async (): Promise<void> => {
        const exitCode = await initHandler([packageDir], { cliVersion: '0.1.0' });

        expect(exitCode).toBe(0);
        expect(stdout).toHaveBeenCalledWith(expect.stringContaining(`${packageDir}: already initialized; nothing changed\n`));
      },
      LIST_TIMEOUT_MS
    );
  });
});
