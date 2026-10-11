import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { turboQueryAffectedTasks, turboQueryFileDeps, turboQueryPackageTasks } from './turbo-query.process.ts';
import type { FixtureCopy } from '../../../test/common/fixture-copy.type.ts';
import { TurboQueryException } from '../common/turbo-query.exception.ts';
import type { PackageTasks } from '../common/turbo-query.type.ts';
import { commitQueryWorkspace, copyQueryWorkspace } from '../test/utils/query-workspace.spec.util.ts';

describe('FEATURE: turbo query process', (): void => {
  describe('GIVEN a workspace where a spec imports a helper, an outside file, a node_modules package and a missing package', (): void => {
    let workspace: FixtureCopy;

    beforeEach(async (): Promise<void> => {
      workspace = await copyQueryWorkspace();
    });

    afterEach(async (): Promise<void> => {
      await workspace.dispose();
    });

    it('WHEN the spec file dependencies are queried THEN only workspace files are returned', async (): Promise<void> => {
      const files = await turboQueryFileDeps(workspace.directory, 'apps/web-e2e/tests/a.spec.ts');

      expect(files).toEqual(['apps/web-e2e/helpers/h.ts', 'shared/x.ts']);
    });

    it('WHEN a missing file is queried THEN a turbo query exception is thrown', async (): Promise<void> => {
      const query = turboQueryFileDeps(workspace.directory, 'apps/web-e2e/tests/missing.spec.ts');

      await expect(query).rejects.toThrow(TurboQueryException);
    });

    it('WHEN the test package tasks are queried THEN each workspace dependency is listed with its tasks', async (): Promise<void> => {
      const web: PackageTasks = { name: 'web', dir: 'apps/web', tasks: ['build', 'start'] };

      const dependencies = await turboQueryPackageTasks(workspace.directory, 'web-e2e');

      expect(dependencies).toEqual([web]);
    });

    it('WHEN a package without workspace dependencies is queried THEN the root package is not listed', async (): Promise<void> => {
      const dependencies = await turboQueryPackageTasks(workspace.directory, 'lone');

      expect(dependencies).toEqual([]);
    });

    it('WHEN an unknown package is queried THEN a turbo query exception is thrown', async (): Promise<void> => {
      const query = turboQueryPackageTasks(workspace.directory, 'unknown');

      await expect(query).rejects.toThrow(TurboQueryException);
    });
  });

  describe('GIVEN a committed git workspace whose test package has two tagged file tasks', (): void => {
    let workspace: FixtureCopy;

    beforeEach(async (): Promise<void> => {
      vi.stubEnv('TURBO_SCM_BASE', 'HEAD');
      workspace = await copyQueryWorkspace();
      await commitQueryWorkspace(workspace);
    });

    afterEach(async (): Promise<void> => {
      vi.unstubAllEnvs();
      await workspace.dispose();
    });

    it('WHEN nothing changed THEN no affected task is returned', async (): Promise<void> => {
      const tasks = await turboQueryAffectedTasks(workspace.directory, 'e2e-ci');

      expect(tasks).toEqual([]);
    });

    it('WHEN one spec changed THEN only its file task is returned by full name', async (): Promise<void> => {
      await appendFile(join(workspace.directory, 'apps/web-e2e/tests/a.spec.ts'), '// edit\n');

      const tasks = await turboQueryAffectedTasks(workspace.directory, 'e2e-ci');

      expect(tasks).toEqual(['web-e2e#e2e-ci--tests/a.spec.ts']);
    });

    it('WHEN a spec changed but another task group is queried THEN no task is returned', async (): Promise<void> => {
      await appendFile(join(workspace.directory, 'apps/web-e2e/tests/a.spec.ts'), '// edit\n');

      const tasks = await turboQueryAffectedTasks(workspace.directory, 'smoke');

      expect(tasks).toEqual([]);
    });
  });
});
