import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { planInit } from './init-preflight.ts';
import { PeerVersionException } from '../../shared/workspace/common/peer-version.exception.ts';
import { UnknownLockfileException } from '../../shared/workspace/common/unknown-lockfile.exception.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture, fixtureDirectory } from '../../test/utils/fixture-copy.spec.util.ts';
import { InitConflictException } from '../common/init-conflict.exception.ts';
import type { InitOptions, PeerVersions } from '../common/init.type.ts';
import { initDepsMock } from '../test/mocks/init.mock.ts';
import { PEER_VERSIONS_STUB } from '../test/stubs/init.stub.ts';

const PNPM_ROOT = fixtureDirectory('init-pnpm');
const PNPM_PACKAGE_DIR = join(PNPM_ROOT, 'apps/web-e2e');

const optionsFor = (packageDir: string, generatedDir?: string): InitOptions => {
  const options: InitOptions = { cliVersion: '0.1.0', generatedDir, packageDir };

  return options;
};

describe('FEATURE: init preflight', (): void => {
  describe('GIVEN the untouched init-pnpm fixture', (): void => {
    it('WHEN init is planned THEN the generated package, package manager and test turbo.json creation are planned', async (): Promise<void> => {
      const generated = { dir: 'tools/web-e2e-atoms', name: '@acme/web-e2e-atoms' };
      const turboJsonPlan: unknown = expect.objectContaining({ kind: 'create' });

      const plan = await planInit(optionsFor(PNPM_PACKAGE_DIR), initDepsMock().versions);

      expect(plan).toMatchObject({ generated, packageName: '@acme/web-e2e', pm: 'pnpm', root: PNPM_ROOT, turboJsonPlan });
    });

    it('WHEN init is planned with --generated-dir THEN that dir is used without its trailing slash', async (): Promise<void> => {
      const plan = await planInit(optionsFor(PNPM_PACKAGE_DIR, 'tools/custom/'), initDepsMock().versions);

      expect(plan.generated.dir).toBe('tools/custom');
    });

    it('WHEN turbo is above the tested range THEN the plan carries the warning', async (): Promise<void> => {
      const untested: PeerVersions = { ...PEER_VERSIONS_STUB, turbo: '2.12.0' };
      const { versions } = initDepsMock();

      vi.mocked(versions).mockResolvedValue(untested);

      const plan = await planInit(optionsFor(PNPM_PACKAGE_DIR), versions);

      expect(plan.warnings).toEqual([expect.stringContaining('turbo 2.12.0 is outside the tested range')]);
    });

    it('WHEN Playwright is below the minimum THEN it rejects with PeerVersionException', async (): Promise<void> => {
      const tooOld: PeerVersions = { ...PEER_VERSIONS_STUB, playwright: '1.55.0' };
      const { versions } = initDepsMock();

      vi.mocked(versions).mockResolvedValue(tooOld);

      const planning = planInit(optionsFor(PNPM_PACKAGE_DIR), versions);

      await expect(planning).rejects.toBeInstanceOf(PeerVersionException);
    });

    it('WHEN init is planned for the workspace root, which has no Playwright config THEN it rejects with InitConflictException', async (): Promise<void> => {
      const planning = planInit(optionsFor(PNPM_ROOT), initDepsMock().versions);

      await expect(planning).rejects.toBeInstanceOf(InitConflictException);
    });
  });

  describe('GIVEN a workspace with only a yarn.lock', (): void => {
    it('WHEN init is planned THEN it rejects with UnknownLockfileException naming yarn.lock', async (): Promise<void> => {
      const packageDir = join(fixtureDirectory('init-yarn'), 'apps/web-e2e');

      const planning = planInit(optionsFor(packageDir), initDepsMock().versions);

      await expect(planning).rejects.toThrow(UnknownLockfileException);
      await expect(planning).rejects.toThrow('found yarn.lock');
    });
  });

  describe('GIVEN an init-pnpm copy', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
      packageDir = join(copy.directory, 'apps/web-e2e');
    });

    afterEach(async (): Promise<void> => {
      await copy.dispose();
    });

    it('WHEN the config sets generatedPackage and no --generated-dir is passed THEN the configured dir is used', async (): Promise<void> => {
      await writeFile(join(packageDir, 'turbo-atomizer.json'), '{ "generatedPackage": "tools/x-atoms" }\n');

      const plan = await planInit(optionsFor(packageDir), initDepsMock().versions);

      expect(plan.generated.dir).toBe('tools/x-atoms');
    });

    it('WHEN --generated-dir differs from the configured generatedPackage THEN it rejects with InitConflictException', async (): Promise<void> => {
      await writeFile(join(packageDir, 'turbo-atomizer.json'), '{ "generatedPackage": "tools/x-atoms" }\n');

      const planning = planInit(optionsFor(packageDir, 'tools/y-atoms'), initDepsMock().versions);

      await expect(planning).rejects.toThrow(/generatedPackage "tools\/x-atoms" but --generated-dir is "tools\/y-atoms"/);
    });

    it('WHEN the test package has an e2e-ci script THEN it rejects with InitConflictException naming the script', async (): Promise<void> => {
      await writeFile(join(packageDir, 'package.json'), '{ "name": "@acme/web-e2e", "scripts": { "e2e-ci": "playwright test" } }\n');

      const planning = planInit(optionsFor(packageDir), initDepsMock().versions);

      await expect(planning).rejects.toThrow(/script named "e2e-ci"/);
    });

    it('WHEN the test package.json has no name THEN it rejects with InitConflictException', async (): Promise<void> => {
      await writeFile(join(packageDir, 'package.json'), '{ "private": true }\n');

      const planning = planInit(optionsFor(packageDir), initDepsMock().versions);

      await expect(planning).rejects.toThrow(/has no "name"/);
    });

    it('WHEN the generated dir holds another package THEN it rejects with InitConflictException', async (): Promise<void> => {
      const generatedDir = join(copy.directory, 'tools/web-e2e-atoms');

      await mkdir(generatedDir, { recursive: true });
      await writeFile(join(generatedDir, 'package.json'), '{ "name": "@acme/other" }\n');

      const planning = planInit(optionsFor(packageDir), initDepsMock().versions);

      await expect(planning).rejects.toThrow(/holds @acme\/other/);
    });
  });
});
