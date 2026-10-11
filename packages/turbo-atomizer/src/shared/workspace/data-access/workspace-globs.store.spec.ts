import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readPackageJsonWorkspaces } from './root-package-json.store.ts';
import { ensureWorkspaceGlob, findExcludingGlob, readWorkspaceGlobs } from './workspace-globs.store.ts';
import type { FixtureCopy } from '../../../test/common/fixture-copy.type.ts';
import { copyFixture, fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';

describe('FEATURE: workspace globs store', (): void => {
  let copy: FixtureCopy;

  afterEach(async (): Promise<void> => {
    await copy.dispose();
  });

  describe('GIVEN a pnpm workspace with a commented pnpm-workspace.yaml', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
    });

    it('WHEN the globs are read THEN the packages entries are returned', async (): Promise<void> => {
      const globs = await readWorkspaceGlobs(fixtureDirectory('init-pnpm'), 'pnpm');

      expect(globs).toEqual(['apps/*']);
    });

    it('WHEN an uncovered dir is ensured THEN a change is reported', async (): Promise<void> => {
      const changed = await ensureWorkspaceGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      expect(changed).toBe(true);
    });

    it('WHEN an uncovered dir is ensured THEN the dir is appended to packages', async (): Promise<void> => {
      await ensureWorkspaceGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      const globs = await readWorkspaceGlobs(copy.directory, 'pnpm');

      expect(globs).toEqual(['apps/*', 'tools/web-e2e-atoms']);
    });

    it('WHEN an uncovered dir is ensured THEN both comments are kept', async (): Promise<void> => {
      await ensureWorkspaceGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      const text = await readFile(join(copy.directory, 'pnpm-workspace.yaml'), 'utf8');

      expect(text).toBe("# Apps and their e2e suites.\npackages:\n  - 'apps/*' # every app\n  - tools/web-e2e-atoms\n");
    });

    it('WHEN the same dir is ensured twice THEN the second call reports no change', async (): Promise<void> => {
      await ensureWorkspaceGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      const changed = await ensureWorkspaceGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      expect(changed).toBe(false);
    });

    it('WHEN a dir an existing glob covers is ensured THEN no change is reported', async (): Promise<void> => {
      const changed = await ensureWorkspaceGlob(copy.directory, 'pnpm', 'apps/web-e2e-atoms');

      expect(changed).toBe(false);
    });
  });

  describe('GIVEN a pnpm-workspace.yaml with a ./ prefix, a trailing slash and a negation', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');

      await writeFile(join(copy.directory, 'pnpm-workspace.yaml'), "packages:\n  - '!apps/**'\n  - './tools/*/'\n");
    });

    it('WHEN a dir the prefixed glob covers is ensured THEN no change is reported', async (): Promise<void> => {
      const changed = await ensureWorkspaceGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      expect(changed).toBe(false);
    });

    it('WHEN the excluding glob of a dir the negation misses is looked up THEN none is found', async (): Promise<void> => {
      const excluding = await findExcludingGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      expect(excluding).toBeUndefined();
    });
  });

  describe('GIVEN a pnpm-workspace.yaml whose negation excludes the generated dir', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');

      await writeFile(join(copy.directory, 'pnpm-workspace.yaml'), "packages:\n  - 'tools/*'\n  - '!tools/web-e2e-atoms'\n");
    });

    it('WHEN the excluding glob is looked up THEN the negation is returned', async (): Promise<void> => {
      const excluding = await findExcludingGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      expect(excluding).toBe('!tools/web-e2e-atoms');
    });
  });

  describe('GIVEN a pnpm-workspace.yaml with only a negation', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');

      await writeFile(join(copy.directory, 'pnpm-workspace.yaml'), "packages:\n  - '!apps/legacy'\n");
    });

    it('WHEN a dir is ensured THEN the negation does not count as covering it and a change is reported', async (): Promise<void> => {
      const changed = await ensureWorkspaceGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      expect(changed).toBe(true);
    });
  });

  describe('GIVEN a pnpm-workspace.yaml without packages', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');

      await writeFile(join(copy.directory, 'pnpm-workspace.yaml'), '# catalog only\ncatalog:\n  zod: ^4.0.0\n');
    });

    it('WHEN the globs are read THEN an empty list is returned', async (): Promise<void> => {
      const globs = await readWorkspaceGlobs(copy.directory, 'pnpm');

      expect(globs).toEqual([]);
    });

    it('WHEN a dir is ensured THEN a packages list is added beside the catalog', async (): Promise<void> => {
      await ensureWorkspaceGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      const text = await readFile(join(copy.directory, 'pnpm-workspace.yaml'), 'utf8');

      expect(text).toBe('# catalog only\ncatalog:\n  zod: ^4.0.0\npackages:\n  - tools/web-e2e-atoms\n');
    });
  });

  describe('GIVEN a pnpm workspace without pnpm-workspace.yaml', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');

      await rm(join(copy.directory, 'pnpm-workspace.yaml'));
    });

    it('WHEN a dir is ensured THEN pnpm-workspace.yaml is created with it', async (): Promise<void> => {
      await ensureWorkspaceGlob(copy.directory, 'pnpm', 'tools/web-e2e-atoms');

      const text = await readFile(join(copy.directory, 'pnpm-workspace.yaml'), 'utf8');

      expect(text).toBe('packages:\n  - tools/web-e2e-atoms\n');
    });
  });

  describe('GIVEN an npm workspace', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-npm');
    });

    it('WHEN the globs are read THEN package.json workspaces are returned', async (): Promise<void> => {
      const globs = await readWorkspaceGlobs(fixtureDirectory('init-npm'), 'npm');

      expect(globs).toEqual(['apps/*']);
    });

    it('WHEN an uncovered dir is ensured THEN it is appended to package.json workspaces', async (): Promise<void> => {
      await ensureWorkspaceGlob(copy.directory, 'npm', 'tools/web-e2e-atoms');

      const globs = await readWorkspaceGlobs(copy.directory, 'npm');

      expect(globs).toEqual(['apps/*', 'tools/web-e2e-atoms']);
    });

    it('WHEN the same dir is ensured twice THEN the second call reports no change', async (): Promise<void> => {
      await ensureWorkspaceGlob(copy.directory, 'npm', 'tools/web-e2e-atoms');

      const changed = await ensureWorkspaceGlob(copy.directory, 'npm', 'tools/web-e2e-atoms');

      expect(changed).toBe(false);
    });
  });

  describe('GIVEN an npm workspace with a stray pnpm-workspace.yaml that does not cover the dir', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-npm');

      await writeFile(join(copy.directory, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
    });

    it('WHEN the same dir is ensured twice THEN the second call reports no change', async (): Promise<void> => {
      await ensureWorkspaceGlob(copy.directory, 'npm', 'tools/web-e2e-atoms');

      const changed = await ensureWorkspaceGlob(copy.directory, 'npm', 'tools/web-e2e-atoms');

      expect(changed).toBe(false);
    });
  });

  describe('GIVEN an npm workspace with a stray pnpm-workspace.yaml that covers the dir', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-npm');

      await writeFile(join(copy.directory, 'pnpm-workspace.yaml'), "packages:\n  - 'tools/*'\n");
    });

    it('WHEN the dir is ensured THEN it is appended to package.json workspaces', async (): Promise<void> => {
      await ensureWorkspaceGlob(copy.directory, 'npm', 'tools/web-e2e-atoms');

      const workspaces = await readPackageJsonWorkspaces(copy.directory);

      expect(workspaces).toEqual(['apps/*', 'tools/web-e2e-atoms']);
    });
  });

  describe('GIVEN an npm workspace with a stray pnpm-workspace.yaml that negates the dir', (): void => {
    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('init-npm');

      await writeFile(join(copy.directory, 'pnpm-workspace.yaml'), "packages:\n  - '!tools/web-e2e-atoms'\n");
    });

    it('WHEN the excluding glob is looked up THEN package.json workspaces are read and none is found', async (): Promise<void> => {
      const excluding = await findExcludingGlob(copy.directory, 'npm', 'tools/web-e2e-atoms');

      expect(excluding).toBeUndefined();
    });
  });
});
