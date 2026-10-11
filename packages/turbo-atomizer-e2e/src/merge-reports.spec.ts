import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { TEST_PACKAGE_DIR } from './test/common/fixture-workspace.const.ts';
import type { FixtureWorkspace } from './test/common/fixture-workspace.type.ts';
import { createSyncedWorkspace } from './test/utils/atomizer-setup.spec.util.ts';
import { isPmSelected } from './test/utils/e2e-env.spec.util.ts';
import { reportedFiles } from './test/utils/playwright-report.spec.util.ts';
import { missedTaskIds, summarizedRun } from './test/utils/turbo-summary.spec.util.ts';
import { outputOf } from './test/utils/workspace-command.spec.util.ts';

const PLAYWRIGHT_CONFIG = `${TEST_PACKAGE_DIR}/playwright.config.ts`;
const SEARCH_SPEC = `${TEST_PACKAGE_DIR}/tests/search.spec.ts`;
const ATOMIZER_DIR = `${TEST_PACKAGE_DIR}/.atomizer`;
const MERGE_CONFIG = `${TEST_PACKAGE_DIR}/playwright.atomizer-merge.config.mjs`;
const MERGED_JSON = `${TEST_PACKAGE_DIR}/merged-report/report.json`;
const MERGED_HTML = `${TEST_PACKAGE_DIR}/merged-report/html/index.html`;
const REPORTERS =
  "reporter: [['html', { outputFolder: 'merged-report/html', open: 'never' }], ['json', { outputFile: 'merged-report/report.json' }]],";
const BROKEN_TEST = "\ntest('breaks on purpose', () => {\n  throw new Error('broken on purpose');\n});\n";
const ALL_FILES = [
  'auth.setup.ts',
  'cart.spec.ts',
  'checkout.spec.ts',
  'home.spec.ts',
  'login.spec.ts',
  'profile.spec.ts',
  'search.spec.ts'
];

describe('FEATURE: merge-reports', (): void => {
  describe.runIf(isPmSelected('pnpm'))(
    'GIVEN the pnpm-basic workspace, initialized and synced, walked through one CI journey in order',
    (): void => {
      let workspace: FixtureWorkspace;

      beforeAll(async (): Promise<() => Promise<void>> => {
        workspace = await createSyncedWorkspace('pnpm-basic', 'pnpm');

        return workspace.dispose;
      });

      it('WHEN the Playwright config reports html and json into an ignored folder and sync reruns THEN sync exits 0', async (): Promise<void> => {
        const config = await workspace.read(PLAYWRIGHT_CONFIG);
        const gitignore = await workspace.read('.gitignore');

        await workspace.edit(PLAYWRIGHT_CONFIG, config.replace("reporter: 'list',", REPORTERS));
        await workspace.edit('.gitignore', `${gitignore}merged-report/\n`);

        const sync = await workspace.run('turbo-atomizer sync');

        await workspace.commit('merged reporters');

        expect(sync, outputOf(sync)).toMatchObject({ exitCode: 0 });
      });

      it('WHEN merge-reports runs before any e2e-ci run THEN it warns that no file task left a blob, exits 0 and writes no report', async (): Promise<void> => {
        const merge = await workspace.run('turbo-atomizer merge-reports');
        const hasReport = existsSync(join(workspace.root, MERGED_JSON));

        expect(merge, outputOf(merge)).toMatchObject({ exitCode: 0 });
        expect(merge.stderr).toContain('0 of 6 file tasks left a blob report');
        expect(hasReport).toBe(false);
      });

      it('WHEN e2e-ci runs, its outputs are removed and it replays fully from cache THEN merge-reports exits 0 without a count warning', async (): Promise<void> => {
        const first = await summarizedRun(workspace.root, 'turbo run e2e-ci');

        await workspace.remove(ATOMIZER_DIR);

        const replay = await summarizedRun(workspace.root, 'turbo run e2e-ci');
        const merge = await workspace.run('turbo-atomizer merge-reports');

        expect(first.result, outputOf(first.result)).toMatchObject({ exitCode: 0 });
        expect(replay.result, outputOf(replay.result)).toMatchObject({ exitCode: 0 });
        expect(missedTaskIds(replay.tasks)).toEqual([]);
        expect(merge, outputOf(merge)).toMatchObject({ exitCode: 0 });
        expect(merge.stderr).not.toContain('left a blob report');
      });

      it('WHEN the merged json report is read THEN it lists the tests of every file', async (): Promise<void> => {
        const report = await workspace.read(MERGED_JSON);

        const files = reportedFiles(report);

        expect(files).toEqual(ALL_FILES);
      });

      it('WHEN the config dir is checked after the merge THEN the html report is there and the temporary merge config is gone', (): void => {
        const hasHtml = existsSync(join(workspace.root, MERGED_HTML));
        const hasMergeConfig = existsSync(join(workspace.root, MERGE_CONFIG));

        expect(hasHtml).toBe(true);
        expect(hasMergeConfig).toBe(false);
      });

      it('WHEN only one file task replays into an empty output dir THEN merge-reports warns about the count and merges that file only', async (): Promise<void> => {
        await workspace.remove(ATOMIZER_DIR);

        const replay = await summarizedRun(workspace.root, 'turbo run e2e-ci--tests/login.spec.ts --filter=web-e2e');
        const merge = await workspace.run('turbo-atomizer merge-reports');
        const report = await workspace.read(MERGED_JSON);
        const files = reportedFiles(report);

        expect(replay.result, outputOf(replay.result)).toMatchObject({ exitCode: 0 });
        expect(missedTaskIds(replay.tasks)).toEqual([]);
        expect(merge, outputOf(merge)).toMatchObject({ exitCode: 0 });
        expect(merge.stderr).toContain('1 of 6 file tasks left a blob report');
        expect(merge.stderr).toContain('--affected');
        expect(files).toEqual(['auth.setup.ts', 'login.spec.ts']);
      });

      it('WHEN one spec breaks and e2e-ci continues past it THEN merge-reports exits 1', async (): Promise<void> => {
        const spec = await workspace.read(SEARCH_SPEC);

        await workspace.edit(SEARCH_SPEC, `${spec}${BROKEN_TEST}`);

        const run = await summarizedRun(workspace.root, 'turbo run e2e-ci --continue=dependencies-successful');
        const merge = await workspace.run('turbo-atomizer merge-reports');

        expect(run.result.exitCode).not.toBe(0);
        expect(merge, outputOf(merge)).toMatchObject({ exitCode: 1 });
        expect(merge.stderr).not.toContain('left a blob report');
      });
    }
  );
});
