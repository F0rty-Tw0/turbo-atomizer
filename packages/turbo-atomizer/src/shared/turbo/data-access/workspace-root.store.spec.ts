import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findWorkspaceRoot } from './workspace-root.store.ts';
import { WorkspaceRootMissingException } from '../common/workspace-root-missing.exception.ts';
import { turboFixtureDir } from '../test/utils/turbo-fixture.spec.util.ts';

describe('FEATURE: workspace root store', (): void => {
  describe('GIVEN a workspace with a turbo.jsonc at its root', (): void => {
    it('WHEN searched from a nested package THEN the turbo.jsonc directory is returned', async (): Promise<void> => {
      const root = turboFixtureDir('jsonc-workspace');

      const found = await findWorkspaceRoot(join(root, 'packages/app'));

      expect(found).toBe(root);
    });
  });

  describe('GIVEN a workspace whose test package has its own turbo.json with "extends"', (): void => {
    it('WHEN searched from the test package THEN the package turbo.json is skipped and the root returned', async (): Promise<void> => {
      const root = turboFixtureDir('package-turbo-workspace');

      const found = await findWorkspaceRoot(join(root, 'apps/e2e'));

      expect(found).toBe(root);
    });
  });

  describe('GIVEN a tree without turbo.json or turbo.jsonc up to the filesystem root', (): void => {
    it('WHEN searched THEN it rejects with WorkspaceRootMissingException', async (): Promise<void> => {
      const searching = findWorkspaceRoot(tmpdir());

      await expect(searching).rejects.toBeInstanceOf(WorkspaceRootMissingException);
    });
  });
});
