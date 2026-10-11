import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listWorkspaceDirs } from './workspace-dirs.store.ts';
import { fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';

describe('FEATURE: workspace dirs store', (): void => {
  describe('GIVEN the init-pnpm fixture', (): void => {
    const root = fixtureDirectory('init-pnpm');

    it('WHEN its workspace globs are expanded THEN only directories are returned, absolute', async (): Promise<void> => {
      const dirs = await listWorkspaceDirs(root, ['apps/*', 'package.json']);

      expect(dirs).toEqual([join(root, 'apps/web-e2e')]);
    });

    it('WHEN a negated glob matches a dir THEN that dir is excluded', async (): Promise<void> => {
      const dirs = await listWorkspaceDirs(root, ['apps/*', '!apps/web-e2e']);

      expect(dirs).toEqual([]);
    });

    it('WHEN a glob carries ./ and a trailing slash THEN it still matches', async (): Promise<void> => {
      const dirs = await listWorkspaceDirs(root, ['./apps/web-e2e/']);

      expect(dirs).toEqual([join(root, 'apps/web-e2e')]);
    });

    it('WHEN there are no globs THEN no dir is returned', async (): Promise<void> => {
      const dirs = await listWorkspaceDirs(root, []);

      expect(dirs).toEqual([]);
    });
  });
});
