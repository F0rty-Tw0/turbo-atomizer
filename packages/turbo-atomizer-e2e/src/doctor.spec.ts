import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { TEST_PACKAGE_DIR } from './test/common/fixture-workspace.const.ts';
import type { FixtureWorkspace } from './test/common/fixture-workspace.type.ts';
import { createSyncedWorkspace } from './test/utils/atomizer-setup.spec.util.ts';
import { outputOf } from './test/utils/workspace-command.spec.util.ts';
import { replaceInWorkspace, resetWorkspace } from './test/utils/workspace-edit.spec.util.ts';

const TESTS_DIR = `${TEST_PACKAGE_DIR}/tests`;
const HOME_SPEC = `${TESTS_DIR}/home.spec.ts`;
const SHARED_FILE = 'shared/x.ts';
const SHARED_SOURCE = "export const shared = 'x';\n";
const SHARED_IMPORT = "import { shared } from '../../../shared/x.ts';\n\nexport const sharedValue = shared;\n";
const ATOMIZER_CONFIG = `${TEST_PACKAGE_DIR}/turbo-atomizer.json`;
const COVERED_CONFIG = '{ "generatedPackage": "tools/web-e2e-atoms", "extraInputs": ["$TURBO_ROOT$/shared/**"] }\n';
const TEST_PACKAGE_JSON = `${TEST_PACKAGE_DIR}/package.json`;
const APP_DEPENDENCY = '"web": "workspace:*"';
const GENERATED_DIR = 'tools/web-e2e-atoms';

/** Adds `shared/x.ts` at the workspace root and imports it from the home spec. */
const importSharedFile = async (workspace: FixtureWorkspace): Promise<void> => {
  const homeSpec = await workspace.read(HOME_SPEC);

  await workspace.edit(SHARED_FILE, SHARED_SOURCE);
  await workspace.edit(HOME_SPEC, `${SHARED_IMPORT}${homeSpec}`);
};

describe('FEATURE: doctor on a packed consumer', (): void => {
  describe('GIVEN the pnpm-basic workspace after init and sync, reset to that commit after every case', (): void => {
    let workspace: FixtureWorkspace;

    beforeAll(async (): Promise<() => Promise<void>> => {
      workspace = await createSyncedWorkspace('pnpm-basic', 'pnpm');

      return workspace.dispose;
    });

    afterEach(async (): Promise<void> => {
      await resetWorkspace(workspace);
    });

    it('WHEN doctor runs THEN it exits 0 with no error and only the setup-projects warning', async (): Promise<void> => {
      const doctor = await workspace.run('turbo-atomizer doctor');

      expect(doctor, outputOf(doctor)).toMatchObject({ exitCode: 0 });
      expect(doctor.stdout).toContain(`${TEST_PACKAGE_DIR}: 0 errors, 1 warning\n  warning setup-projects: `);
    });

    it('WHEN a spec is added without sync THEN doctor exits 1 with a stale-generated error', async (): Promise<void> => {
      const cartSpec = await workspace.read(`${TESTS_DIR}/cart.spec.ts`);

      await workspace.edit(`${TESTS_DIR}/orders.spec.ts`, cartSpec);

      const doctor = await workspace.run('turbo-atomizer doctor');

      expect(doctor, outputOf(doctor)).toMatchObject({ exitCode: 1 });
      expect(doctor.stdout).toContain('  error stale-generated: The generated file tasks are stale (1 added, 0 removed, 0 changed)');
    });

    it('WHEN a spec is deleted without sync THEN doctor exits 1 with a stale-generated error instead of a turbo query crash', async (): Promise<void> => {
      await workspace.remove(`${TESTS_DIR}/search.spec.ts`);

      const doctor = await workspace.run('turbo-atomizer doctor');

      expect(doctor, outputOf(doctor)).toMatchObject({ exitCode: 1 });
      expect(doctor.stdout).toContain('  error stale-generated: The generated file tasks are stale (0 added, 1 removed, 0 changed)');
    });

    it('WHEN the generated package is deleted THEN doctor exits 1 with both the stale-generated and the turbo-query-failed error', async (): Promise<void> => {
      await workspace.remove(GENERATED_DIR);

      const doctor = await workspace.run('turbo-atomizer doctor');

      expect(doctor, outputOf(doctor)).toMatchObject({ exitCode: 1 });
      expect(doctor.stdout).toContain('  error stale-generated: ');
      expect(doctor.stdout).toContain('  error turbo-query-failed: ');
    });

    it('WHEN a spec imports a root file nothing covers THEN doctor exits 1 with an outside-import error naming both', async (): Promise<void> => {
      await importSharedFile(workspace);

      const doctor = await workspace.run('turbo-atomizer doctor');

      expect(doctor, outputOf(doctor)).toMatchObject({ exitCode: 1 });
      expect(doctor.stdout).toContain('  error outside-import: tests/home.spec.ts imports shared/x.ts, ');
    });

    it('WHEN that import is covered by a $TURBO_ROOT$ extraInputs glob and synced THEN doctor exits 0', async (): Promise<void> => {
      await importSharedFile(workspace);
      await workspace.edit(ATOMIZER_CONFIG, COVERED_CONFIG);

      const sync = await workspace.run('turbo-atomizer sync');
      const doctor = await workspace.run('turbo-atomizer doctor');

      expect(sync, outputOf(sync)).toMatchObject({ exitCode: 0 });
      expect(doctor, outputOf(doctor)).toMatchObject({ exitCode: 0 });
      expect(doctor.stdout).not.toContain('outside-import');
    });

    it('WHEN the test package no longer depends on the app THEN doctor exits 1 with an app-dependency-missing error', async (): Promise<void> => {
      await replaceInWorkspace(workspace, TEST_PACKAGE_JSON, APP_DEPENDENCY, '');

      const doctor = await workspace.run('turbo-atomizer doctor');

      expect(doctor, outputOf(doctor)).toMatchObject({ exitCode: 1 });
      expect(doctor.stdout).toContain('  error app-dependency-missing: ');
    });

    it('WHEN the root affectedUsingTaskInputs flag is off THEN doctor exits 0 with an affected-flag-missing warning', async (): Promise<void> => {
      await replaceInWorkspace(workspace, 'turbo.json', '"affectedUsingTaskInputs": true', '"affectedUsingTaskInputs": false');

      const doctor = await workspace.run('turbo-atomizer doctor');

      expect(doctor, outputOf(doctor)).toMatchObject({ exitCode: 0 });
      expect(doctor.stdout).toContain('  warning affected-flag-missing: ');
    });

    it('WHEN the root experimentalTaskCommand flag is off THEN doctor exits 1 with a root-flag-missing error', async (): Promise<void> => {
      await replaceInWorkspace(workspace, 'turbo.json', '"experimentalTaskCommand": true', '"experimentalTaskCommand": false');

      const doctor = await workspace.run('turbo-atomizer doctor');

      expect(doctor, outputOf(doctor)).toMatchObject({ exitCode: 1 });
      expect(doctor.stdout).toContain('  error root-flag-missing: ');
    });
  });
});
