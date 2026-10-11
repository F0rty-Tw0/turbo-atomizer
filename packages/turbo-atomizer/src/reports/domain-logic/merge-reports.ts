import { dirname, join, resolve } from 'node:path';

import type { AtomizerMetadata } from '../../shared/atomizer/common/atomizer.type.ts';
import type { AtomizerConfig } from '../../shared/config/common/atomizer-config.type.ts';
import { loadAtomizerConfig } from '../../shared/config/domain-logic/atomizer-config.ts';
import { listSpecs } from '../../shared/playwright/data-access/playwright-list.process.ts';
import { runPlaywrightMerge } from '../../shared/playwright/data-access/playwright-merge.process.ts';
import { readTurboJson } from '../../shared/turbo/data-access/turbo-json.store.ts';
import { findWorkspaceRoot } from '../../shared/turbo/data-access/workspace-root.store.ts';
import { toAtomSlug } from '../../sync/utils/atom-slug.util.ts';
import { MERGE_STATUS_FILE, PASSED_STATUS } from '../common/reports.const.ts';
import { collectBlobs, createBlobDir, removeBlobDir } from '../data-access/blob-collect.store.ts';
import { removeMergeConfig, writeMergeConfig } from '../data-access/merge-config.store.ts';
import { readMergeStatus } from '../data-access/merge-status.store.ts';
import { blobCountWarning, missingBlobMessage } from '../utils/blob-count.util.ts';
import { toFileTaskPaths } from '../utils/file-tasks.util.ts';
import { renderMergeConfig } from '../utils/merge-config.util.ts';

type MergeRun = {
  readonly blobDir: string;
  readonly configDir: string;
  readonly metadata: AtomizerMetadata;
  readonly packageDir: string;
  readonly statusReporterPath: string;
  readonly testDir: string;
};

const failMerge = (packageDir: string, message: string): number => {
  process.stderr.write(`turbo-atomizer merge-reports: ${packageDir}: ${message}\n`);

  return 1;
};

const readFileTaskSlugs = async (packageDir: string, config: AtomizerConfig): Promise<string[] | undefined> => {
  const root = await findWorkspaceRoot(packageDir);
  const generated = await readTurboJson(resolve(root, config.generatedPackage));

  if (generated === undefined) return undefined;

  const tasks = generated.content.tasks ?? {};

  return toFileTaskPaths(tasks, config.task).map(toAtomSlug);
};

/** No status means the reporter never ran, so the merged result is unknown: fail rather than report a pass. */
const statusExitCode = (packageDir: string, status: string | undefined): number => {
  if (status === undefined) return failMerge(packageDir, 'the merge left no merge status, so its result is unknown');

  if (status === PASSED_STATUS) return 0;

  return 1;
};

/** Playwright 1.64 `merge-reports` exits 0 when tests failed, so a zero exit defers to the status reporter's file. */
const mergedExitCode = async (run: MergeRun, configPath: string, statusFile: string): Promise<number> => {
  const exitCode = await runPlaywrightMerge(run.packageDir, run.blobDir, configPath);

  if (exitCode !== 0) return exitCode;

  const status = await readMergeStatus(statusFile);

  return statusExitCode(run.packageDir, status);
};

const runMerge = async (run: MergeRun): Promise<number> => {
  const statusFile = join(run.blobDir, MERGE_STATUS_FILE);
  const statusOptions = { statusFile };
  const statusReporter: [string, unknown] = [run.statusReporterPath, statusOptions];
  const text = renderMergeConfig(run.metadata.reporters, run.testDir, statusReporter);
  const configPath = await writeMergeConfig(run.configDir, text);

  try {
    return await mergedExitCode(run, configPath, statusFile);
  } finally {
    await removeMergeConfig(configPath);
  }
};

/** A file task that ran without leaving a blob crashed before Playwright reported, so the merge fails even when the rest pass. */
const missingExitCode = (packageDir: string, missing: string[]): number => {
  if (missing.length === 0) return 0;

  return failMerge(packageDir, missingBlobMessage(missing));
};

const mergeBlobs = async (run: MergeRun, slugs: string[]): Promise<number> => {
  const blobs = await collectBlobs(run.packageDir, slugs, run.blobDir);
  const warning = blobCountWarning(blobs, slugs.length);

  if (warning !== undefined) process.stderr.write(`${warning} Package: ${run.packageDir}\n`);

  const missingCode = missingExitCode(run.packageDir, blobs.missing);

  if (blobs.copied === 0) return missingCode;

  const mergeCode = await runMerge(run);

  return Math.max(mergeCode, missingCode);
};

/**
 * Spec §6.5: merges the blob reports of the current file tasks of one test package; returns the merge exit code.
 * `statusReporterPath` is the merge-status reporter module the merge config loads.
 */
export const mergeReports = async (packageDir: string, statusReporterPath: string): Promise<number> => {
  const { config } = await loadAtomizerConfig(packageDir);
  const listing = await listSpecs(packageDir, config.playwrightConfig, { metadataOnly: true });
  const metadata = listing.metadata;

  if (metadata === undefined) return failMerge(packageDir, `${config.playwrightConfig} is not wrapped in withAtomizer()`);

  const slugs = await readFileTaskSlugs(packageDir, config);

  if (slugs === undefined)
    return failMerge(packageDir, `no generated turbo.json in ${config.generatedPackage}; run turbo-atomizer sync`);

  const configDir = dirname(resolve(packageDir, config.playwrightConfig));
  const blobDir = await createBlobDir();
  const run: MergeRun = { blobDir, configDir, metadata, packageDir, statusReporterPath, testDir: listing.rootDir };

  try {
    return await mergeBlobs(run, slugs);
  } finally {
    await removeBlobDir(blobDir);
  }
};
