import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { syncHandler } from './sync.handler.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';

type WriteSpy = MockInstance<NodeJS.WriteStream['write']>;

const LIST_TIMEOUT_MS = 60_000;

describe('FEATURE: sync handler', (): void => {
  let copy: FixtureCopy;
  let packageDir: string;
  let stdout: WriteSpy;
  let stderr: WriteSpy;

  beforeEach(async (): Promise<void> => {
    copy = await copyFixture('basic');
    packageDir = join(copy.directory, 'apps/e2e');
    stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(async (): Promise<void> => {
    vi.restoreAllMocks();
    await copy.dispose();
  });

  describe('GIVEN a package that was never synced', (): void => {
    it(
      'WHEN it is checked THEN the exit code is 1 and the added file tasks are printed',
      async (): Promise<void> => {
        const exitCode = await syncHandler([packageDir], { check: true });

        expect(exitCode).toBe(1);
        expect(stdout).toHaveBeenCalledWith(expect.stringContaining('  added: e2e-ci--tests/a.spec.ts\n'));
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN it is synced THEN the exit code is 0 and the package is reported updated',
      async (): Promise<void> => {
        const exitCode = await syncHandler([packageDir], { check: false });

        expect(exitCode).toBe(0);
        expect(stdout).toHaveBeenCalledWith(expect.stringContaining(`${packageDir}: updated\n`));
      },
      LIST_TIMEOUT_MS
    );
  });

  describe('GIVEN a package that syncs and one without a Playwright config', (): void => {
    it(
      'WHEN both are synced THEN the exit code is 1, the first is reported and the second fails on stderr',
      async (): Promise<void> => {
        const brokenDir = join(copy.directory, 'apps/outside');

        const exitCode = await syncHandler([packageDir, brokenDir], { check: false });

        expect(exitCode).toBe(1);
        expect(stdout).toHaveBeenCalledWith(expect.stringContaining(`${packageDir}: updated\n`));
        expect(stderr).toHaveBeenCalledWith(expect.stringContaining(`${brokenDir}: playwright test --list failed`));
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN the failing one is synced first THEN the exit code is still 1',
      async (): Promise<void> => {
        const brokenDir = join(copy.directory, 'apps/outside');

        const exitCode = await syncHandler([brokenDir, packageDir], { check: false });

        expect(exitCode).toBe(1);
      },
      LIST_TIMEOUT_MS
    );
  });

  describe('GIVEN a stale package and an up-to-date one in another workspace', (): void => {
    let syncedCopy: FixtureCopy;
    let syncedDir: string;

    beforeEach(async (): Promise<void> => {
      syncedCopy = await copyFixture('basic');
      syncedDir = join(syncedCopy.directory, 'apps/e2e');
      await syncHandler([syncedDir], { check: false });
    }, LIST_TIMEOUT_MS);

    afterEach(async (): Promise<void> => {
      await syncedCopy.dispose();
    });

    it(
      'WHEN the stale one is checked first THEN the exit code is still 1',
      async (): Promise<void> => {
        const exitCode = await syncHandler([packageDir, syncedDir], { check: true });

        expect(exitCode).toBe(1);
      },
      LIST_TIMEOUT_MS
    );
  });
});
