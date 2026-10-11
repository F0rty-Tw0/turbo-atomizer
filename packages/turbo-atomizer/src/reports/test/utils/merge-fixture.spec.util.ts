import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { z } from 'zod';

import { PLAYWRIGHT_BLOB_OUTPUT_FILE_ENV } from '../../../shared/playwright/common/playwright.const.ts';
import { toAtomSlug } from '../../../sync/utils/atom-slug.util.ts';

const execFileAsync = promisify(execFile);

const require = createRequire(import.meta.url);

const mergedSuiteSchema = z.looseObject({ file: z.string() });

const mergedReportSchema = z.looseObject({ suites: z.array(mergedSuiteSchema) });

const MERGE_PLAYWRIGHT_CONFIG = `import { defineConfig } from '@playwright/test';

import { withAtomizer } from '../../../../../playwright.ts';

export default withAtomizer(
  defineConfig({
    testDir: './tests',
    reporter: [['blob'], ['html', { outputFolder: 'merged-html', open: 'never' }], ['json', { outputFile: 'merged.json' }]]
  })
);
`;

const toJsonText = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Turns a copy of the basic fixture into a configured test package `apps/e2e`: an atomizer config pointing at
 * `playwright.merge.config.ts` (blob, html and json reporters), and a generated `tools/e2e-atoms/turbo.json` listing `taskPaths`.
 * Returns the test package dir.
 */
export const writeMergeFixture = async (root: string, taskPaths: string[]): Promise<string> => {
  const packageDir = join(root, 'apps/e2e');
  const generatedDir = join(root, 'tools/e2e-atoms');
  const atomizerConfig = { generatedPackage: 'tools/e2e-atoms', playwrightConfig: 'playwright.merge.config.ts' };
  const fileTasks = taskPaths.map((taskPath): [string, unknown] => [`e2e-ci--${taskPath}`, { tags: ['atomizer:e2e-ci'] }]);
  const allTask = { dependsOn: fileTasks.map(([name]): string => name) };
  const tasks = Object.fromEntries([...fileTasks, ['e2e-ci--all', allTask]]);
  const generated = { extends: ['//'], tags: ['atomizer:definitions'], tasks };

  await writeFile(join(packageDir, 'playwright.merge.config.ts'), MERGE_PLAYWRIGHT_CONFIG);
  await writeFile(join(packageDir, 'turbo-atomizer.json'), toJsonText(atomizerConfig));
  await mkdir(generatedDir, { recursive: true });
  await writeFile(join(generatedDir, 'turbo.json'), toJsonText(generated));

  return packageDir;
};

/** Spec files named by the top-level suites of the merged `merged.json` report. */
export const readMergedFiles = async (packageDir: string): Promise<string[]> => {
  const text = await readFile(join(packageDir, 'merged.json'), 'utf8');
  const report = mergedReportSchema.parse(JSON.parse(text));

  return report.suites.map((suite): string => suite.file);
};

/** The exit code of a child that exited non-zero; rethrows anything else, such as a missing binary. */
const exitCodeOf = (error: unknown): number => {
  const hasCode = error instanceof Error && 'code' in error;

  if (hasCode && typeof error.code === 'number') return error.code;

  throw error;
};

/** Runs one spec file with the blob reporter only, writing `.atomizer/<slug>/blob.zip` as exec would; returns Playwright's exit code. */
export const runBlobReport = async (packageDir: string, taskPath: string): Promise<number> => {
  const cli = require.resolve('@playwright/test/cli');
  const blobFile = join('.atomizer', toAtomSlug(taskPath), 'blob.zip');
  const env = { ...process.env, [PLAYWRIGHT_BLOB_OUTPUT_FILE_ENV]: blobFile };
  const args = [cli, 'test', taskPath, '--config=playwright.merge.config.ts', '--reporter=blob'];

  try {
    await execFileAsync(process.execPath, args, { cwd: packageDir, env });

    return 0;
  } catch (error) {
    return exitCodeOf(error);
  }
};
