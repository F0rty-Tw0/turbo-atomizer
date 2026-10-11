import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { mergeReports } from './merge-reports.ts';
import { runPlaywrightMerge } from '../../shared/playwright/data-access/playwright-merge.process.ts';
import type * as mergeProcess from '../../shared/playwright/data-access/playwright-merge.process.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import { MERGE_CONFIG_FILE } from '../common/reports.const.ts';
import { readMergedFiles, runBlobReport, writeMergeFixture } from '../test/utils/merge-fixture.spec.util.ts';

type MergeProcessModule = typeof mergeProcess;

vi.mock(
  import('../../shared/playwright/data-access/playwright-merge.process.ts'),
  async (importOriginal): Promise<MergeProcessModule> => {
    const actual = await importOriginal();
    const mocked: MergeProcessModule = { runPlaywrightMerge: vi.fn(actual.runPlaywrightMerge) };

    return mocked;
  }
);

const MERGE_TIMEOUT_MS = 120_000;
const UNWRAPPED_ATOMIZER_CONFIG = '{ "playwrightConfig": "playwright.unwrapped.config.ts" }\n';

const stderrText = (calls: unknown[][]): string => calls.map(([chunk]): string => String(chunk)).join('');

describe('FEATURE: merge reports', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
    vi.mocked(runPlaywrightMerge).mockClear();
  });

  describe('GIVEN a package with blobs for 2 of its 3 file tasks and an html reporter', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = await writeMergeFixture(copy.directory, ['tests/a.spec.ts', 'tests/b.spec.ts', 'tests/nested/c.spec.ts']);
      await runBlobReport(packageDir, 'tests/a.spec.ts');
      await runBlobReport(packageDir, 'tests/b.spec.ts');
    }, MERGE_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    describe('WHEN the reports are merged', (): void => {
      let exitCode: number;
      let stderr: string;

      beforeAll(async (): Promise<void> => {
        const spy = vi.spyOn(process.stderr, 'write');

        exitCode = await mergeReports(packageDir);
        stderr = stderrText(spy.mock.calls);
        spy.mockRestore();
      }, MERGE_TIMEOUT_MS);

      it('THEN the exit code is 0', (): void => {
        expect(exitCode).toBe(0);
      });

      it('THEN the html report is written where the reporter options say', (): void => {
        expect(existsSync(join(packageDir, 'merged-html/index.html'))).toBe(true);
      });

      it('THEN the merged report holds the tests of both blobs', async (): Promise<void> => {
        const files = await readMergedFiles(packageDir);

        expect(files.toSorted()).toEqual(['a.spec.ts', 'b.spec.ts']);
      });

      it('THEN the temporary merge config is removed', (): void => {
        expect(existsSync(join(packageDir, MERGE_CONFIG_FILE))).toBe(false);
      });

      it('THEN a warning names the count mismatch and --affected', (): void => {
        expect(stderr).toContain('2 of 3');
        expect(stderr).toContain('--affected');
      });
    });

    it(
      'WHEN the merge throws THEN the temporary merge config is still removed',
      async (): Promise<void> => {
        const failure = new Error('merge crashed');

        vi.mocked(runPlaywrightMerge).mockRejectedValueOnce(failure);

        await expect(mergeReports(packageDir)).rejects.toBe(failure);
        expect(existsSync(join(packageDir, MERGE_CONFIG_FILE))).toBe(false);
      },
      MERGE_TIMEOUT_MS
    );
  });

  describe('GIVEN a package whose file tasks left no blob', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = await writeMergeFixture(copy.directory, ['tests/a.spec.ts']);
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN the reports are merged THEN it exits 0 without running a merge',
      async (): Promise<void> => {
        vi.spyOn(process.stderr, 'write').mockReturnValue(true);

        const exitCode = await mergeReports(packageDir);

        expect(exitCode).toBe(0);
        expect(runPlaywrightMerge).not.toHaveBeenCalled();
      },
      MERGE_TIMEOUT_MS
    );
  });

  describe('GIVEN a package without the generated turbo.json', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = await writeMergeFixture(copy.directory, []);
      await rm(join(copy.directory, 'tools'), { force: true, recursive: true });
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN the reports are merged THEN it exits 1 and asks for sync',
      async (): Promise<void> => {
        const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

        const exitCode = await mergeReports(packageDir);

        expect(exitCode).toBe(1);
        expect(stderrText(spy.mock.calls)).toContain('turbo-atomizer sync');
      },
      MERGE_TIMEOUT_MS
    );
  });

  describe('GIVEN a package whose Playwright config is not wrapped in withAtomizer', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = join(copy.directory, 'apps/e2e');
      await writeFile(join(packageDir, 'turbo-atomizer.json'), UNWRAPPED_ATOMIZER_CONFIG);
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN the reports are merged THEN it exits 1 and names withAtomizer',
      async (): Promise<void> => {
        const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

        const exitCode = await mergeReports(packageDir);

        expect(exitCode).toBe(1);
        expect(stderrText(spy.mock.calls)).toContain('withAtomizer');
      },
      MERGE_TIMEOUT_MS
    );
  });
});
