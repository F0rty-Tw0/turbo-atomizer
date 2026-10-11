import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { gatherDoctorFacts } from './doctor-facts.ts';
import { PlaywrightListException } from '../../shared/playwright/common/playwright-list.exception.ts';
import { syncPackage } from '../../sync/domain-logic/sync.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import type { DoctorDeps, DoctorFacts } from '../common/doctor-facts.type.ts';
import { PackageNameMissingException } from '../common/package-name-missing.exception.ts';
import { doctorDepsMock } from '../test/mocks/doctor.mock.ts';
import { WEB_PACKAGE_TASKS_STUB } from '../test/stubs/doctor-facts.stub.ts';

const LIST_TIMEOUT_MS = 60_000;

const writeAtomizerConfig = async (packageDir: string, config: Record<string, unknown>): Promise<void> => {
  await writeFile(join(packageDir, 'turbo-atomizer.json'), JSON.stringify(config));
};

describe('FEATURE: gather doctor facts', (): void => {
  describe('GIVEN a synced copy of the doctor fixture whose spec imports a helper and a file outside the package', (): void => {
    let copy: FixtureCopy;
    let deps: DoctorDeps;
    let facts: DoctorFacts;
    let fileQueries: unknown[][];
    let packageQueries: unknown[][];

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('doctor');
      deps = doctorDepsMock();
      vi.mocked(deps.queryFileDeps).mockResolvedValue(['apps/e2e/helpers/h.ts', 'shared/x.ts']);

      const packageDir = join(copy.directory, 'apps/e2e');

      await syncPackage(packageDir, { check: false });
      facts = await gatherDoctorFacts(packageDir, deps);
      fileQueries = [...vi.mocked(deps.queryFileDeps).mock.calls];
      packageQueries = [...vi.mocked(deps.queryPackageTasks).mock.calls];
    }, LIST_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it('THEN the generated file is current and no spec is rejected', (): void => {
      const syncFacts = { stale: facts.stale, rejectedSpecs: facts.rejectedSpecs };

      expect(syncFacts).toEqual({ stale: undefined, rejectedSpecs: [] });
    });

    it('THEN the helper metadata lists the web server', (): void => {
      const webServers = facts.metadata?.webServers;

      expect(webServers).toMatchObject([{ url: 'http://localhost:3000' }]);
    });

    it('THEN the package dir is posix and relative to the workspace root, with the config task and generated name', (): void => {
      const names = { packageDir: facts.packageDir, task: facts.task, generatedName: facts.generatedName };

      expect(names).toEqual({ packageDir: 'apps/e2e', task: 'e2e-ci', generatedName: 'e2e-atoms' });
    });

    it('THEN both root future flags are read as set', (): void => {
      const flags = { taskCommandFlagSet: facts.taskCommandFlagSet, affectedFlagSet: facts.affectedFlagSet };

      expect(flags).toEqual({ taskCommandFlagSet: true, affectedFlagSet: true });
    });

    it('THEN the test turbo.json and the configured dependsOn and extraInputs are read', (): void => {
      const config = { extends: facts.testTurboJson?.content.extends, dependsOn: facts.dependsOn, extraInputs: facts.extraInputs };

      expect(config).toEqual({ extends: ['//', 'e2e-atoms'], dependsOn: ['^build'], extraInputs: [] });
    });

    it('THEN each file task spec is queried by its path relative to the workspace root', (): void => {
      expect(fileQueries).toEqual([[copy.directory, 'apps/e2e/tests/a.spec.ts']]);
    });

    it('THEN only the import outside the package is kept', (): void => {
      expect(facts.outsideImports).toEqual([{ spec: 'tests/a.spec.ts', file: 'shared/x.ts' }]);
    });

    it('THEN the dependency tasks come from the package query for the test package name', (): void => {
      expect(packageQueries).toEqual([[copy.directory, 'e2e']]);
      expect(facts.dependencyTasks).toEqual([WEB_PACKAGE_TASKS_STUB]);
    });

    it('THEN the installed turbo and Playwright versions are read', (): void => {
      const versions = [facts.versions.turbo, facts.versions.playwright];

      expect(versions).toEqual([expect.stringMatching(/^\d+\.\d+\.\d+/), expect.stringMatching(/^\d+\.\d+\.\d+/)]);
    });
  });

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
      'WHEN it was never synced THEN stale lists the spec file task as added',
      async (): Promise<void> => {
        const facts = await gatherDoctorFacts(packageDir, doctorDepsMock());

        expect(facts.stale).toEqual({ added: ['e2e-ci--tests/a.spec.ts'], removed: [], changed: [] });
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN it was never synced THEN no spec is queried for imports',
      async (): Promise<void> => {
        const deps = doctorDepsMock();

        await gatherDoctorFacts(packageDir, deps);

        expect(deps.queryFileDeps).not.toHaveBeenCalled();
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN its Playwright config is not wrapped in withAtomizer THEN metadata and stale are undefined',
      async (): Promise<void> => {
        await writeAtomizerConfig(packageDir, { playwrightConfig: 'playwright.unwrapped.config.ts' });

        const facts = await gatherDoctorFacts(packageDir, doctorDepsMock());

        expect({ metadata: facts.metadata, stale: facts.stale }).toEqual({ metadata: undefined, stale: undefined });
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN specGlobs do not match its spec THEN the spec is rejected by its package-relative path',
      async (): Promise<void> => {
        await writeAtomizerConfig(packageDir, { specGlobs: ['**/*.test.ts'] });

        const facts = await gatherDoctorFacts(packageDir, doctorDepsMock());

        expect({ rejectedSpecs: facts.rejectedSpecs, stale: facts.stale }).toEqual({ rejectedSpecs: ['tests/a.spec.ts'], stale: undefined });
      },
      LIST_TIMEOUT_MS
    );

    it('WHEN the test package has no name THEN a package-name-missing exception is thrown', async (): Promise<void> => {
      await writeFile(join(packageDir, 'package.json'), '{ "private": true }\n');

      const gathering = gatherDoctorFacts(packageDir, doctorDepsMock());

      await expect(gathering).rejects.toThrow(PackageNameMissingException);
    });

    it(
      'WHEN its Playwright config does not exist THEN the listing error is thrown',
      async (): Promise<void> => {
        await writeAtomizerConfig(packageDir, { playwrightConfig: 'playwright.missing.config.ts' });

        const gathering = gatherDoctorFacts(packageDir, doctorDepsMock());

        await expect(gathering).rejects.toThrow(PlaywrightListException);
      },
      LIST_TIMEOUT_MS
    );
  });
});
