import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { mergeReports } from './merge-reports.ts';
import { runPlaywrightMerge } from '../../shared/playwright/data-access/playwright-merge.process.ts';
import type * as mergeProcess from '../../shared/playwright/data-access/playwright-merge.process.ts';
import { toAtomSlug } from '../../sync/utils/atom-slug.util.ts';
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
const STATUS_REPORTER_PATH = join(import.meta.dirname, '../../merge-status-reporter.ts');
const FAILING_SPEC = "import { expect, test } from '@playwright/test';\n\ntest('d fails', () => {\n  expect(1 + 1).toBe(3);\n});\n";

const stderrText = (calls: unknown[][]): string => calls.map(([chunk]): string => String(chunk)).join('');

/** What exec leaves when a file task crashes before Playwright writes its blob, such as a failed server lease. */
const writeEmptySlugDir = async (packageDir: string, taskPath: string): Promise<void> => {
  await mkdir(join(packageDir, '.atomizer', toAtomSlug(taskPath)), { recursive: true });
};

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

        exitCode = await mergeReports(packageDir, STATUS_REPORTER_PATH);
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

        await expect(mergeReports(packageDir, STATUS_REPORTER_PATH)).rejects.toBe(failure);
        expect(existsSync(join(packageDir, MERGE_CONFIG_FILE))).toBe(false);
      },
      MERGE_TIMEOUT_MS
    );

    it(
      'WHEN the merge exits non-zero THEN that exit code is returned',
      async (): Promise<void> => {
        vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        vi.mocked(runPlaywrightMerge).mockResolvedValueOnce(2);

        const exitCode = await mergeReports(packageDir, STATUS_REPORTER_PATH);

        expect(exitCode).toBe(2);
      },
      MERGE_TIMEOUT_MS
    );

    it(
      'WHEN the merge exits 0 without the status reporter running THEN it exits 1 and says the status is missing',
      async (): Promise<void> => {
        const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

        vi.mocked(runPlaywrightMerge).mockResolvedValueOnce(0);

        const exitCode = await mergeReports(packageDir, STATUS_REPORTER_PATH);

        expect(exitCode).toBe(1);
        expect(stderrText(spy.mock.calls)).toContain('no merge status');
      },
      MERGE_TIMEOUT_MS
    );
  });

  describe('GIVEN a package whose only blob holds a failed test', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;
    let blobExitCode: number;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = await writeMergeFixture(copy.directory, ['tests/d.spec.ts']);
      await writeFile(join(packageDir, 'tests/d.spec.ts'), FAILING_SPEC);
      blobExitCode = await runBlobReport(packageDir, 'tests/d.spec.ts');
    }, MERGE_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN the reports are merged THEN it exits 1',
      async (): Promise<void> => {
        vi.spyOn(process.stderr, 'write').mockReturnValue(true);

        const exitCode = await mergeReports(packageDir, STATUS_REPORTER_PATH);

        expect(blobExitCode).toBe(1);
        expect(exitCode).toBe(1);
      },
      MERGE_TIMEOUT_MS
    );
  });

  describe('GIVEN a package with a blob for one file task and another file task that ran without a blob', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;
    let exitCode: number;
    let stderr: string;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = await writeMergeFixture(copy.directory, ['tests/a.spec.ts', 'tests/b.spec.ts']);
      await runBlobReport(packageDir, 'tests/a.spec.ts');
      await writeEmptySlugDir(packageDir, 'tests/b.spec.ts');

      const spy = vi.spyOn(process.stderr, 'write');

      exitCode = await mergeReports(packageDir, STATUS_REPORTER_PATH);
      stderr = stderrText(spy.mock.calls);
      spy.mockRestore();
    }, MERGE_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    describe('WHEN the reports are merged', (): void => {
      it('THEN it exits 1', (): void => {
        expect(exitCode).toBe(1);
      });

      it('THEN stderr names the file task that ran but left no blob report', (): void => {
        expect(stderr).toContain('1 file task ran but left no blob report');
        expect(stderr).toContain(toAtomSlug('tests/b.spec.ts'));
      });

      it('THEN the merged report still holds the tests of the blob it found', async (): Promise<void> => {
        const files = await readMergedFiles(packageDir);

        expect(files).toEqual(['a.spec.ts']);
      });
    });
  });

  describe('GIVEN a package whose only file task ran without a blob', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = await writeMergeFixture(copy.directory, ['tests/a.spec.ts']);
      await writeEmptySlugDir(packageDir, 'tests/a.spec.ts');
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN the reports are merged THEN it exits 1 without running a merge',
      async (): Promise<void> => {
        vi.spyOn(process.stderr, 'write').mockReturnValue(true);

        const exitCode = await mergeReports(packageDir, STATUS_REPORTER_PATH);

        expect(exitCode).toBe(1);
        expect(runPlaywrightMerge).not.toHaveBeenCalled();
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

        const exitCode = await mergeReports(packageDir, STATUS_REPORTER_PATH);

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

        const exitCode = await mergeReports(packageDir, STATUS_REPORTER_PATH);

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

        const exitCode = await mergeReports(packageDir, STATUS_REPORTER_PATH);

        expect(exitCode).toBe(1);
        expect(stderrText(spy.mock.calls)).toContain('withAtomizer');
      },
      MERGE_TIMEOUT_MS
    );
  });
});
