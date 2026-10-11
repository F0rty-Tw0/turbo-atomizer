import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { doctorHandler } from './doctor.handler.ts';
import { syncPackage } from '../../sync/domain-logic/sync.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';

type WriteSpy = MockInstance<NodeJS.WriteStream['write']>;

const RUN_TIMEOUT_MS = 60_000;

const ROOT_TURBO_JSON_WITHOUT_AFFECTED_FLAG = `{
  "agentGuidance": false,
  "futureFlags": { "experimentalTaskCommand": true },
  "tasks": { "build": { "outputs": ["dist/**"] } }
}
`;

describe('FEATURE: doctor handler', (): void => {
  let copy: FixtureCopy;
  let packageDir: string;
  let stdout: WriteSpy;
  let stderr: WriteSpy;

  beforeEach(async (): Promise<void> => {
    copy = await copyFixture('doctor');
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
      'WHEN doctor runs THEN the exit code is 1 and the stale-generated error is printed',
      async (): Promise<void> => {
        const exitCode = await doctorHandler([packageDir]);

        expect(exitCode).toBe(1);
        expect(stdout).toHaveBeenCalledWith(expect.stringContaining('  error stale-generated: '));
      },
      RUN_TIMEOUT_MS
    );
  });

  describe('GIVEN a synced package without specs and a root turbo.json without affectedUsingTaskInputs', (): void => {
    beforeEach(async (): Promise<void> => {
      await rm(join(packageDir, 'tests/a.spec.ts'));
      await writeFile(join(copy.directory, 'turbo.json'), ROOT_TURBO_JSON_WITHOUT_AFFECTED_FLAG);
      await syncPackage(packageDir, { check: false });
    }, RUN_TIMEOUT_MS);

    it(
      'WHEN doctor runs THEN the exit code is 0 and the warning is printed',
      async (): Promise<void> => {
        const exitCode = await doctorHandler([packageDir]);

        expect(exitCode).toBe(0);
        expect(stdout).toHaveBeenCalledWith(expect.stringContaining('  warning affected-flag-missing: '));
      },
      RUN_TIMEOUT_MS
    );

    it(
      'WHEN doctor runs on a failing package before it THEN the exit code stays 1',
      async (): Promise<void> => {
        const missingDir = join(copy.directory, 'apps/missing');

        const exitCode = await doctorHandler([missingDir, packageDir]);

        expect(exitCode).toBe(1);
      },
      RUN_TIMEOUT_MS
    );
  });

  describe('GIVEN a test package without a name', (): void => {
    it('WHEN doctor runs THEN the exit code is 1 and stderr names the package', async (): Promise<void> => {
      await writeFile(join(packageDir, 'package.json'), '{ "private": true }\n');

      const exitCode = await doctorHandler([packageDir]);

      expect(exitCode).toBe(1);
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining(`${packageDir}: `));
    });
  });
});
