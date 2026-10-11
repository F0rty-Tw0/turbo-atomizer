import { beforeAll, describe, expect, it } from 'vitest';

import {
  ATOMS_TURBO_JSON,
  PNPM_BASIC_SPECS,
  TEST_PACKAGE_DIR,
  TURBO_ATOMIZER_ARGS_ENV,
  TURBO_SCM_BASE_ENV
} from './test/common/fixture-workspace.const.ts';
import type { FixtureCase, FixtureWorkspace } from './test/common/fixture-workspace.type.ts';
import { createSyncedWorkspace } from './test/utils/atomizer-setup.spec.util.ts';
import { isPmSelected } from './test/utils/e2e-env.spec.util.ts';
import { createFixtureWorkspace } from './test/utils/fixture-workspace.spec.util.ts';
import { startCount } from './test/utils/server-starts.spec.util.ts';
import {
  cacheStatusOf,
  changedAtomTaskIds,
  dryRunTasks,
  failedFileTaskIds,
  fileTaskId,
  fileTaskIds,
  leakedInputs,
  missedFileTaskIds,
  missedTaskIds,
  summarizedRun
} from './test/utils/turbo-summary.spec.util.ts';
import { outputOf } from './test/utils/workspace-command.spec.util.ts';

const FIXTURE_CASES: FixtureCase[] = [
  { fixture: 'pnpm-basic', pm: 'pnpm' },
  { fixture: 'npm-basic', pm: 'npm' }
];
const JOURNEYS = FIXTURE_CASES.filter(({ pm }): boolean => isPmSelected(pm));
const ALL_FILE_TASKS = PNPM_BASIC_SPECS.map(fileTaskId);
const TESTS_DIR = `${TEST_PACKAGE_DIR}/tests`;
const LOGIN_SPEC = `${TESTS_DIR}/login.spec.ts`;
const SEARCH_SPEC = `${TESTS_DIR}/search.spec.ts`;
const ADDED_SPEC = `${TESTS_DIR}/orders.spec.ts`;
const APP_PAGE = 'apps/web/src/index.html';
const BROKEN_TEST = "\ntest('breaks on purpose', () => {\n  throw new Error('broken on purpose');\n});\n";

describe('FEATURE: regression', (): void => {
  describe.each(JOURNEYS)(
    'GIVEN the $fixture workspace on $pm, walked through one consumer journey in order',
    ({ fixture, pm }): void => {
      let workspace: FixtureWorkspace;

      beforeAll(async (): Promise<() => Promise<void>> => {
        workspace = await createFixtureWorkspace(fixture, pm);

        return workspace.dispose;
      });

      it('WHEN init and sync run from the workspace root THEN both exit 0', async (): Promise<void> => {
        const init = await workspace.run(`turbo-atomizer init --package ${TEST_PACKAGE_DIR}`);
        const sync = await workspace.run('turbo-atomizer sync');

        await workspace.commit('init');

        expect(init, outputOf(init)).toMatchObject({ exitCode: 0 });
        expect(sync, outputOf(sync)).toMatchObject({ exitCode: 0 });
      });

      it('WHEN e2e-ci runs the first time THEN 2N+1 tasks run, every file task passes and the server starts once', async (): Promise<void> => {
        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci');
        const starts = await startCount(workspace.root, 'starts');

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(missedFileTaskIds(run.tasks)).toEqual(ALL_FILE_TASKS);
        expect(run.tasks).toHaveLength(2 * PNPM_BASIC_SPECS.length + 1);
        expect(starts).toBe(1);
      });

      it('WHEN the task inputs are listed THEN no file task or carrier input lies in an ignored folder', async (): Promise<void> => {
        const tasks = await dryRunTasks(workspace.root, 'e2e-ci');

        expect(leakedInputs(tasks)).toEqual([]);
      });

      it('WHEN e2e-ci runs again unchanged THEN every task replays from cache and no server starts', async (): Promise<void> => {
        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci');
        const starts = await startCount(workspace.root, 'starts');

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(missedTaskIds(run.tasks)).toEqual([]);
        expect(starts).toBe(1);
      });

      it('WHEN one spec is edited THEN only its file task runs', async (): Promise<void> => {
        const spec = await workspace.read(LOGIN_SPEC);

        await workspace.edit(LOGIN_SPEC, `${spec}// edited\n`);

        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci');

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(missedFileTaskIds(run.tasks)).toEqual([fileTaskId('tests/login.spec.ts')]);
      });

      it("WHEN a file in one spec's snapshot folder changes THEN only that file task runs", async (): Promise<void> => {
        await workspace.edit(`${TESTS_DIR}/checkout.spec.ts-snapshots/heading-webkit-linux.txt`, 'Atomizer fixture');

        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci');

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(missedFileTaskIds(run.tasks)).toEqual([fileTaskId('tests/checkout.spec.ts')]);
      });

      it('WHEN a spec is added THEN sync --check names it, and sync adds it without changing any other task hash', async (): Promise<void> => {
        const before = await workspace.taskHashes();
        const cartSpec = await workspace.read(`${TESTS_DIR}/cart.spec.ts`);

        await workspace.edit(ADDED_SPEC, cartSpec);

        const check = await workspace.run('turbo-atomizer sync --check');
        const sync = await workspace.run('turbo-atomizer sync');
        const after = await workspace.taskHashes();

        expect(check, outputOf(check)).toMatchObject({ exitCode: 1 });
        expect(check.stdout).toContain('added: e2e-ci--tests/orders.spec.ts');
        expect(sync, outputOf(sync)).toMatchObject({ exitCode: 0 });
        expect(after).toHaveProperty([fileTaskId('tests/orders.spec.ts')]);
        expect(changedAtomTaskIds(before, after)).toEqual([]);
      });

      it('WHEN a spec is removed and synced THEN its task is gone and no other task hash changes', async (): Promise<void> => {
        const before = await workspace.taskHashes();

        await workspace.remove(ADDED_SPEC);

        const sync = await workspace.run('turbo-atomizer sync');
        const after = await workspace.taskHashes();

        expect(sync, outputOf(sync)).toMatchObject({ exitCode: 0 });
        expect(after).not.toHaveProperty([fileTaskId('tests/orders.spec.ts')]);
        expect(changedAtomTaskIds(before, after)).toEqual([]);
      });

      it('WHEN the app source is edited THEN every file task runs', async (): Promise<void> => {
        const page = await workspace.read(APP_PAGE);

        await workspace.edit(APP_PAGE, `${page}<!-- edited -->\n`);

        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci');

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(missedFileTaskIds(run.tasks)).toEqual(ALL_FILE_TASKS);
      });

      it('WHEN the app changes, one spec breaks and the run continues THEN the other file tasks pass and only it fails', async (): Promise<void> => {
        const page = await workspace.read(APP_PAGE);
        const spec = await workspace.read(SEARCH_SPEC);

        await workspace.edit(APP_PAGE, `${page}<!-- edited again -->\n`);
        await workspace.edit(SEARCH_SPEC, `${spec}${BROKEN_TEST}`);

        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci --continue=dependencies-successful');

        expect(run.result.exitCode).not.toBe(0);
        expect(missedFileTaskIds(run.tasks)).toEqual(ALL_FILE_TASKS);
        expect(failedFileTaskIds(run.tasks)).toEqual([fileTaskId('tests/search.spec.ts')]);
      });

      it('WHEN the broken spec is fixed and the run repeats THEN only that file task runs', async (): Promise<void> => {
        await workspace.run(`git checkout -- ${SEARCH_SPEC}`);

        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci --continue=dependencies-successful');

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(missedFileTaskIds(run.tasks)).toEqual([fileTaskId('tests/search.spec.ts')]);
      });

      it('WHEN a file task has a stale list line THEN that task fails and nothing is cached for it', async (): Promise<void> => {
        const atoms = await workspace.read(ATOMS_TURBO_JSON);

        await workspace.edit(ATOMS_TURBO_JSON, atoms.replace('"login.spec.ts"', '"stale/login.spec.ts"'));

        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci --continue=dependencies-successful');
        const tasks = await dryRunTasks(workspace.root, 'e2e-ci');
        const restore = await workspace.run('turbo-atomizer sync');

        expect(run.result.exitCode).not.toBe(0);
        expect(run.result.stdout).toContain('no tests selected for tests/login.spec.ts');
        expect(failedFileTaskIds(run.tasks)).toEqual([fileTaskId('tests/login.spec.ts')]);
        expect(cacheStatusOf(tasks, fileTaskId('tests/login.spec.ts'))).toBe('MISS');
        expect(restore, outputOf(restore)).toMatchObject({ exitCode: 0 });
      });

      it('WHEN TURBO_ATOMIZER_ARGS holds --grep @smoke THEN every file task reruns and passes, matching or not', async (): Promise<void> => {
        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci', { [TURBO_ATOMIZER_ARGS_ENV]: '--grep @smoke' });

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(missedFileTaskIds(run.tasks)).toEqual(ALL_FILE_TASKS);
        expect(run.result.stdout).toContain('sign in is offered @smoke');
        expect(run.result.stdout).not.toContain('cart is linked');
      });

      it("WHEN e2e-ci--all runs without --filter THEN it passes and the generated package's copies are skipped", async (): Promise<void> => {
        const run = await workspace.run('turbo run e2e-ci--all');

        expect(run, outputOf(run)).toMatchObject({ exitCode: 0 });
        expect(run.stdout).toContain('turbo-atomizer: skipped tests/login.spec.ts in the generated package');
      });

      it('WHEN one spec changes after the committed base THEN turbo-atomizer affected runs only its file task', async (): Promise<void> => {
        await workspace.commit('synced');

        const base = await workspace.run('git rev-parse HEAD');
        const spec = await workspace.read(LOGIN_SPEC);

        await workspace.edit(LOGIN_SPEC, `${spec}// affected\n`);

        const run = await summarizedRun(workspace.root, 'turbo-atomizer affected --', { [TURBO_SCM_BASE_ENV]: base.stdout.trim() });

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(fileTaskIds(run.tasks)).toEqual([fileTaskId('tests/login.spec.ts')]);
        expect(missedFileTaskIds(run.tasks)).toEqual([fileTaskId('tests/login.spec.ts')]);
      });

      it('WHEN nothing changed after the committed base THEN turbo-atomizer affected exits 0 without a turbo run', async (): Promise<void> => {
        await workspace.commit('affected edit');

        const run = await summarizedRun(workspace.root, 'turbo-atomizer affected --', { [TURBO_SCM_BASE_ENV]: 'HEAD' });

        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(run.result.stdout).toContain('no affected file tasks in web-e2e');
        expect(run.tasks).toEqual([]);
      });

      it('WHEN every spec is removed and synced THEN e2e-ci is a passing no-op', async (): Promise<void> => {
        const removals = PNPM_BASIC_SPECS.map(async (spec): Promise<void> => workspace.remove(`${TEST_PACKAGE_DIR}/${spec}`));

        await Promise.all(removals);

        const sync = await workspace.run('turbo-atomizer sync');
        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci');

        expect(sync, outputOf(sync)).toMatchObject({ exitCode: 0 });
        expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
        expect(fileTaskIds(run.tasks)).toEqual([]);
      });
    }
  );

  describe.runIf(isPmSelected('pnpm'))('GIVEN the two-servers workspace, initialized and synced', (): void => {
    let workspace: FixtureWorkspace;

    beforeAll(async (): Promise<() => Promise<void>> => {
      workspace = await createSyncedWorkspace('two-servers', 'pnpm');

      return workspace.dispose;
    });

    it('WHEN e2e-ci runs with concurrency 10 THEN all 10 file tasks pass and each server starts once', async (): Promise<void> => {
      const run = await summarizedRun(workspace.root, 'turbo run e2e-ci --concurrency=10');
      const mainStarts = await startCount(workspace.root, 'starts-1');
      const sideStarts = await startCount(workspace.root, 'starts-2');

      expect(run.result, outputOf(run.result)).toMatchObject({ exitCode: 0 });
      expect(missedFileTaskIds(run.tasks)).toHaveLength(10);
      expect(failedFileTaskIds(run.tasks)).toEqual([]);
      expect(mainStarts).toBe(1);
      expect(sideStarts).toBe(1);
    });
  });
});
