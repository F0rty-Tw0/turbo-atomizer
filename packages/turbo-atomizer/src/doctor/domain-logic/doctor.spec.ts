import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { doctorPackage } from './doctor.ts';
import { turboQueryPackageTasks } from '../../shared/turbo/data-access/turbo-query.process.ts';
import { syncPackage } from '../../sync/domain-logic/sync.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import type { DoctorDeps } from '../common/doctor-facts.type.ts';
import { doctorDepsMock } from '../test/mocks/doctor.mock.ts';

const RUN_TIMEOUT_MS = 60_000;

const realPackageQueryDeps = (): DoctorDeps => {
  const { queryFileDeps } = doctorDepsMock();
  const deps: DoctorDeps = { queryFileDeps, queryPackageTasks: turboQueryPackageTasks };

  return deps;
};

describe('FEATURE: doctor one test package', (): void => {
  describe('GIVEN a copy of the doctor fixture', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('doctor');
      packageDir = join(copy.directory, 'apps/e2e');
    });

    afterEach(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN it is synced and its spec imports nothing outside the package THEN there are no findings',
      async (): Promise<void> => {
        await syncPackage(packageDir, { check: false });

        const findings = await doctorPackage(packageDir, realPackageQueryDeps());

        expect(findings).toEqual([]);
      },
      RUN_TIMEOUT_MS
    );

    it(
      'WHEN it is synced and its spec imports an uncovered file outside the package THEN an outside-import error is found',
      async (): Promise<void> => {
        const deps = realPackageQueryDeps();

        vi.mocked(deps.queryFileDeps).mockResolvedValue(['shared/x.ts']);
        await syncPackage(packageDir, { check: false });

        const findings = await doctorPackage(packageDir, deps);

        expect(findings).toMatchObject([{ level: 'error', code: 'outside-import' }]);
      },
      RUN_TIMEOUT_MS
    );

    it(
      'WHEN its Playwright config is not wrapped in withAtomizer THEN only a helper-missing error is found',
      async (): Promise<void> => {
        await writeFile(join(packageDir, 'turbo-atomizer.json'), '{ "playwrightConfig": "playwright.unwrapped.config.ts" }\n');

        const findings = await doctorPackage(packageDir, realPackageQueryDeps());

        expect(findings).toMatchObject([{ level: 'error', code: 'helper-missing' }]);
      },
      RUN_TIMEOUT_MS
    );
  });
});
