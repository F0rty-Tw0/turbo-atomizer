import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendPackageJsonWorkspace, ensureRootDevDependency, readPackageJsonWorkspaces } from './root-package-json.store.ts';
import type { FixtureCopy } from '../../../test/common/fixture-copy.type.ts';
import { copyFixture, fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';

const readManifest = async (root: string): Promise<unknown> => {
  const text = await readFile(join(root, 'package.json'), 'utf8');
  const manifest: unknown = JSON.parse(text);

  return manifest;
};

describe('FEATURE: root package.json store', (): void => {
  let copy: FixtureCopy;

  afterEach(async (): Promise<void> => {
    await copy.dispose();
  });

  describe('GIVEN a root without turbo-atomizer', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
    });

    it('WHEN the devDependency is ensured THEN it is added and a change is reported', async (): Promise<void> => {
      const changed = await ensureRootDevDependency(copy.directory, 'turbo-atomizer', '^0.3.0');

      expect(changed).toBe(true);
    });

    it('WHEN the devDependency is ensured THEN it is listed under devDependencies', async (): Promise<void> => {
      await ensureRootDevDependency(copy.directory, 'turbo-atomizer', '^0.3.0');

      const manifest = await readManifest(copy.directory);

      expect(manifest).toHaveProperty(['devDependencies', 'turbo-atomizer'], '^0.3.0');
    });

    it('WHEN the devDependency is ensured THEN the existing devDependencies are kept', async (): Promise<void> => {
      await ensureRootDevDependency(copy.directory, 'turbo-atomizer', '^0.3.0');

      const manifest = await readManifest(copy.directory);

      expect(manifest).toHaveProperty(['devDependencies', 'turbo'], '2.11.7');
    });

    it('WHEN the devDependency is ensured twice THEN the second call reports no change', async (): Promise<void> => {
      await ensureRootDevDependency(copy.directory, 'turbo-atomizer', '^0.3.0');

      const changed = await ensureRootDevDependency(copy.directory, 'turbo-atomizer', '^0.3.0');

      expect(changed).toBe(false);
    });
  });

  describe('GIVEN a root that lists turbo-atomizer as a tarball devDependency', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');

      const devDependencies = { 'turbo-atomizer': 'file:../x.tgz' };
      const manifest = { name: 'acme', private: true, devDependencies };

      await writeFile(join(copy.directory, 'package.json'), JSON.stringify(manifest));
    });

    it('WHEN the devDependency is ensured THEN no change is reported', async (): Promise<void> => {
      const changed = await ensureRootDevDependency(copy.directory, 'turbo-atomizer', '^0.3.0');

      expect(changed).toBe(false);
    });

    it('WHEN the devDependency is ensured THEN the tarball spec is kept', async (): Promise<void> => {
      await ensureRootDevDependency(copy.directory, 'turbo-atomizer', '^0.3.0');

      const manifest = await readManifest(copy.directory);

      expect(manifest).toHaveProperty(['devDependencies', 'turbo-atomizer'], 'file:../x.tgz');
    });
  });

  describe('GIVEN a root that lists turbo-atomizer under dependencies', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');

      const dependencies = { 'turbo-atomizer': 'workspace:*' };
      const manifest = { name: 'acme', dependencies };

      await writeFile(join(copy.directory, 'package.json'), JSON.stringify(manifest));
    });

    it('WHEN the devDependency is ensured THEN no change is reported', async (): Promise<void> => {
      const changed = await ensureRootDevDependency(copy.directory, 'turbo-atomizer', '^0.3.0');

      expect(changed).toBe(false);
    });
  });

  describe('GIVEN a root without devDependencies', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-yarn');
    });

    it('WHEN the devDependency is ensured THEN a devDependencies object is created', async (): Promise<void> => {
      await ensureRootDevDependency(copy.directory, 'turbo-atomizer', '^0.3.0');

      const manifest = await readManifest(copy.directory);

      expect(manifest).toHaveProperty(['devDependencies', 'turbo-atomizer'], '^0.3.0');
    });
  });

  describe('GIVEN workspaces in the { packages } form', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-npm');

      const workspaces = { packages: ['apps/*'] };
      const manifest = { name: 'acme', workspaces };

      await writeFile(join(copy.directory, 'package.json'), JSON.stringify(manifest));
    });

    it('WHEN the workspaces are read THEN the packages globs are returned', async (): Promise<void> => {
      const globs = await readPackageJsonWorkspaces(copy.directory);

      expect(globs).toEqual(['apps/*']);
    });

    it('WHEN a workspace is appended THEN it is added to packages', async (): Promise<void> => {
      await appendPackageJsonWorkspace(copy.directory, 'tools/web-e2e-atoms');

      const globs = await readPackageJsonWorkspaces(copy.directory);

      expect(globs).toEqual(['apps/*', 'tools/web-e2e-atoms']);
    });
  });

  describe('GIVEN a root package.json without workspaces', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
    });

    it('WHEN the workspaces are read THEN an empty list is returned', async (): Promise<void> => {
      const globs = await readPackageJsonWorkspaces(fixtureDirectory('init-pnpm'));

      expect(globs).toEqual([]);
    });

    it('WHEN a workspace is appended THEN a workspaces array is created', async (): Promise<void> => {
      await appendPackageJsonWorkspace(copy.directory, 'tools/web-e2e-atoms');

      const globs = await readPackageJsonWorkspaces(copy.directory);

      expect(globs).toEqual(['tools/web-e2e-atoms']);
    });
  });
});
