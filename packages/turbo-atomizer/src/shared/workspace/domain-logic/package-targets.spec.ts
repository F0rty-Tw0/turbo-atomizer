import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findConfiguredPackages, resolvePackageTargets } from './package-targets.ts';
import type { FixtureCopy } from '../../../test/common/fixture-copy.type.ts';
import { copyFixture, fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';

describe('FEATURE: package targets', (): void => {
  describe('GIVEN the init-pnpm fixture with no atomizer config', (): void => {
    it('WHEN configured packages are found THEN none is returned', async (): Promise<void> => {
      const packages = await findConfiguredPackages(fixtureDirectory('init-pnpm'));

      expect(packages).toEqual([]);
    });
  });

  describe('GIVEN an init-pnpm copy whose test package has turbo-atomizer.json', (): void => {
    let copy: FixtureCopy;
    let testPackageDir: string;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
      testPackageDir = join(copy.directory, 'apps/web-e2e');
      await writeFile(join(testPackageDir, 'turbo-atomizer.json'), '{}\n');
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it('WHEN configured packages are found THEN only the test package is returned', async (): Promise<void> => {
      const packages = await findConfiguredPackages(copy.directory);

      expect(packages).toEqual([testPackageDir]);
    });

    it('WHEN targets are resolved from a nested dir without a package THEN the test package is returned', async (): Promise<void> => {
      const nestedDir = join(testPackageDir, 'tests');

      const targets = await resolvePackageTargets(nestedDir);

      expect(targets).toEqual([testPackageDir]);
    });

    it('WHEN targets are resolved with a package THEN only that dir, resolved against the cwd, is returned', async (): Promise<void> => {
      const targets = await resolvePackageTargets(copy.directory, 'apps/e');

      expect(targets).toEqual([join(copy.directory, 'apps/e')]);
    });
  });
});
