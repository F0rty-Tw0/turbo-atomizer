import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { affectedHandler } from './affected.handler.ts';
import {
  commitQueryWorkspace,
  copyQueryWorkspace,
  stubLocalScmBase
} from '../../shared/turbo/test/utils/query-workspace.spec.util.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';

const RUN_TIMEOUT_MS = 60_000;

describe('FEATURE: affected handler', (): void => {
  let workspace: FixtureCopy;
  let testPackageDir: string;
  let lonePackageDir: string;
  let stdoutSpy: MockInstance<typeof process.stdout.write>;

  beforeEach(async (): Promise<void> => {
    stubLocalScmBase();
    workspace = await copyQueryWorkspace();
    testPackageDir = join(workspace.directory, 'apps/web-e2e');
    lonePackageDir = join(workspace.directory, 'apps/lone');
    await commitQueryWorkspace(workspace);
    stdoutSpy = vi.spyOn(process.stdout, 'write');
  });

  afterEach(async (): Promise<void> => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await workspace.dispose();
  });

  describe('GIVEN a committed workspace without changes', (): void => {
    it(
      'WHEN the test package is handled THEN it reports no affected file tasks and exits 0',
      async (): Promise<void> => {
        const code = await affectedHandler([testPackageDir], { forwarded: [] });

        expect(code).toBe(0);
        expect(stdoutSpy).toHaveBeenCalledWith('no affected file tasks in web-e2e\n');
      },
      RUN_TIMEOUT_MS
    );
  });

  describe('GIVEN a changed spec in the test package', (): void => {
    beforeEach(async (): Promise<void> => {
      await appendFile(join(testPackageDir, 'tests/a.spec.ts'), '// edit\n');
    });

    it(
      'WHEN the test package is handled THEN its affected file task runs and the handler exits 0',
      async (): Promise<void> => {
        const code = await affectedHandler([testPackageDir], { forwarded: [] });

        expect(code).toBe(0);
        expect(stdoutSpy).not.toHaveBeenCalledWith('no affected file tasks in web-e2e\n');
      },
      RUN_TIMEOUT_MS
    );

    it(
      'WHEN turbo fails for the first package THEN the next package is still handled and the failing code is returned',
      async (): Promise<void> => {
        const code = await affectedHandler([testPackageDir, lonePackageDir], { forwarded: ['--no-such-turbo-flag'] });

        expect(code).not.toBe(0);
        expect(stdoutSpy).toHaveBeenCalledWith('no affected file tasks in lone\n');
      },
      RUN_TIMEOUT_MS
    );

    it(
      'WHEN SIGINT arrives while turbo runs for the first package THEN the next package is not handled and the handler exits 130',
      async (): Promise<void> => {
        const listenersBefore = process.listenerCount('SIGINT');
        const handling = affectedHandler([testPackageDir, lonePackageDir], { forwarded: [] });
        const isTurboRunning = (): void => {
          expect(process.listenerCount('SIGINT')).toBeGreaterThan(listenersBefore);
        };

        await vi.waitFor(isTurboRunning, { interval: 5, timeout: RUN_TIMEOUT_MS });
        process.emit('SIGINT', 'SIGINT');

        const code = await handling;

        expect(code).toBe(130);
        expect(stdoutSpy).not.toHaveBeenCalledWith('no affected file tasks in lone\n');
      },
      RUN_TIMEOUT_MS
    );
  });
});
