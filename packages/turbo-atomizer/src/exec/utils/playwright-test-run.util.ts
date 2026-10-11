import { TURBO_ATOMIZER_COUNT_FILE_ENV, TURBO_ATOMIZER_ENV } from '../../shared/atomizer/common/atomizer.const.ts';
import {
  PLAYWRIGHT_BLOB_OUTPUT_FILE_ENV,
  PLAYWRIGHT_HTML_OPEN_ENV,
  PLAYWRIGHT_HTML_OUTPUT_DIR_ENV,
  PLAYWRIGHT_JSON_OUTPUT_FILE_ENV,
  PLAYWRIGHT_JUNIT_OUTPUT_FILE_ENV
} from '../../shared/playwright/common/playwright.const.ts';
import type { ExecArgs, SlugPaths } from '../common/exec.type.ts';

const blobReporters = (needsBlob: boolean): string[] => {
  if (!needsBlob) return [];

  return ['blob'];
};

const reporterList = (execArgs: ExecArgs, countReporterPath: string): string => {
  const blob = blobReporters(execArgs.needsBlob);
  const reporters = [...blob, countReporterPath, ...execArgs.forwardedReporters];

  return reporters.join(',');
};

/** `playwright test` args after the bin: the slug's list and output dir, the joined `--add-reporter`, then fixed and forwarded args. */
export const toPlaywrightTestArgs = (execArgs: ExecArgs, paths: SlugPaths, countReporterPath: string): string[] => {
  const reporters = reporterList(execArgs, countReporterPath);

  return [
    'test',
    '--test-list',
    paths.testList,
    '--output',
    paths.testResults,
    `--add-reporter=${reporters}`,
    ...execArgs.playwrightArgs
  ];
};

/** Spec §6.3 step 6: base env, then the server lease env, then the atomizer values. */
export const toPlaywrightTestEnv = (
  baseEnv: NodeJS.ProcessEnv,
  leaseEnv: Record<string, string>,
  paths: SlugPaths
): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    ...leaseEnv,
    [TURBO_ATOMIZER_ENV]: '1',
    [PLAYWRIGHT_BLOB_OUTPUT_FILE_ENV]: paths.blob,
    [PLAYWRIGHT_HTML_OUTPUT_DIR_ENV]: paths.html,
    [PLAYWRIGHT_HTML_OPEN_ENV]: 'never',
    [PLAYWRIGHT_JSON_OUTPUT_FILE_ENV]: paths.json,
    [PLAYWRIGHT_JUNIT_OUTPUT_FILE_ENV]: paths.junit,
    [TURBO_ATOMIZER_COUNT_FILE_ENV]: paths.count
  };

  return env;
};
