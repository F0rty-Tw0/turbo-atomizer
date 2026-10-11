import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PNPM_BASIC_SPECS, TEST_PACKAGE_DIR } from './test/common/fixture-workspace.const.ts';
import type { FixtureWorkspace } from './test/common/fixture-workspace.type.ts';
import { atomizerConfigFileSchema } from './test/common/turbo-query.schema.ts';
import type { QueriedPackage } from './test/common/turbo-query.type.ts';
import { createSyncedWorkspace } from './test/utils/atomizer-setup.spec.util.ts';
import { isPmSelected } from './test/utils/e2e-env.spec.util.ts';
import { queryPackage, tasksTagged } from './test/utils/turbo-query.spec.util.ts';
import { cacheStatusOf, dryRunTasks } from './test/utils/turbo-summary.spec.util.ts';
import { runChecked } from './test/utils/workspace-command.spec.util.ts';

const TEST_PACKAGE = 'web-e2e';
const GENERATED_PACKAGE = 'web-e2e-atoms';
const CONFIG_FILE = `${TEST_PACKAGE_DIR}/turbo-atomizer.json`;
const FILE_TASK_TAG = 'atomizer:e2e-ci';
const LIVE_TAG = 'atomizer:live';
const CARRIER_TAG = 'atomizer:carrier';
const DEFINITIONS_TAG = 'atomizer:definitions';
const LIVE_SPEC = 'tests/checkout.spec.ts';
const FILE_TASK_PREFIX = 'e2e-ci--';

const fileTaskName = (spec: string): string => `${FILE_TASK_PREFIX}${spec}`;

const carrierName = (spec: string): string => `e2e-ci-src--${spec}`;

const taskIdOf = (name: string): string => `${TEST_PACKAGE}#${name}`;

const isPathSegment = (segment: string): boolean => segment !== '' && segment !== '.' && segment !== '..';

/** `<task>--` plus a relative posix path: no backslash, no leading `/`, no empty, `.` or `..` segment. */
const isFileTaskName = (name: string): boolean => {
  const path = name.slice(FILE_TASK_PREFIX.length);
  const hasPrefix = name.startsWith(FILE_TASK_PREFIX);
  const isPosix = !path.includes('\\');
  const segments = path.split('/');

  return hasPrefix && isPosix && segments.every(isPathSegment);
};

/** Marks `pattern` uncached in the test package's `turbo-atomizer.json`, keeping what init wrote. */
const markUncached = async (workspace: FixtureWorkspace, pattern: string): Promise<void> => {
  const text = await workspace.read(CONFIG_FILE);
  const raw: unknown = JSON.parse(text);
  const config = atomizerConfigFileSchema.parse(raw);
  const uncached = { patterns: [pattern] };
  const updated = { ...config, uncached };

  await workspace.edit(CONFIG_FILE, `${JSON.stringify(updated, null, 2)}\n`);
};

describe('FEATURE: console contract', (): void => {
  describe.runIf(isPmSelected('pnpm'))('GIVEN the pnpm-basic workspace synced with checkout.spec.ts marked uncached', (): void => {
    const cleanups: (() => Promise<void>)[] = [];
    let workspace: FixtureWorkspace;
    let testPackage: QueriedPackage;
    let generatedPackage: QueriedPackage;

    beforeAll(async (): Promise<void> => {
      workspace = await createSyncedWorkspace('pnpm-basic', 'pnpm');
      cleanups.push(workspace.dispose);

      await markUncached(workspace, `**/${LIVE_SPEC}`);
      await runChecked(workspace.root, 'turbo-atomizer sync');

      testPackage = await queryPackage(workspace.root, TEST_PACKAGE);
      generatedPackage = await queryPackage(workspace.root, GENERATED_PACKAGE);
    });

    // vitest skips the teardown a failed beforeAll would return, but always runs afterAll
    afterAll(async (): Promise<void> => {
      for (const cleanup of cleanups) await cleanup();
    });

    it('WHEN turbo query lists the test package THEN every file task carries atomizer:e2e-ci and only the uncached one atomizer:live', (): void => {
      expect(tasksTagged(testPackage, FILE_TASK_TAG)).toEqual(PNPM_BASIC_SPECS.map(fileTaskName));
      expect(tasksTagged(testPackage, LIVE_TAG)).toEqual([fileTaskName(LIVE_SPEC)]);
    });

    it('WHEN turbo query lists the test package THEN every carrier carries atomizer:carrier and never atomizer:e2e-ci', (): void => {
      const carriers = tasksTagged(testPackage, CARRIER_TAG);
      const fileTasks = new Set(tasksTagged(testPackage, FILE_TASK_TAG));

      expect(carriers).toEqual(PNPM_BASIC_SPECS.map(carrierName));
      expect(carriers.filter((name): boolean => fileTasks.has(name))).toEqual([]);
    });

    it('WHEN the file task names are read THEN each is e2e-ci-- plus a posix path relative to the test package', (): void => {
      const names = tasksTagged(testPackage, FILE_TASK_TAG);

      expect(names.filter((name): boolean => !isFileTaskName(name))).toEqual([]);
    });

    it('WHEN turbo query lists the packages THEN the generated package carries atomizer:definitions and the test package does not', (): void => {
      expect(generatedPackage.tags).toContain(DEFINITIONS_TAG);
      expect(testPackage.tags).not.toContain(DEFINITIONS_TAG);
    });

    it('WHEN e2e-ci runs with --dry=json THEN every file task and carrier has a cache status', async (): Promise<void> => {
      const tasks = await dryRunTasks(workspace.root, 'e2e-ci');
      const fileTasks = tasksTagged(testPackage, FILE_TASK_TAG);
      const carriers = tasksTagged(testPackage, CARRIER_TAG);
      const atomTasks = [...fileTasks, ...carriers];
      const taskIds = atomTasks.map(taskIdOf);
      const statuses = taskIds.map((taskId): string | undefined => cacheStatusOf(tasks, taskId));

      expect(taskIds).toHaveLength(PNPM_BASIC_SPECS.length * 2);
      expect(statuses).toEqual(taskIds.map((): string => 'MISS'));
    });
  });
});
