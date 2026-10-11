import { constants } from 'node:os';

import { ATOMIZER_DEFINITIONS_TAG, TURBO_ATOMIZER_ARGS_ENV } from '../../shared/atomizer/common/atomizer.const.ts';
import { findPlaywrightConfig } from '../../shared/config/data-access/atomizer-config.store.ts';
import { readTurboJson } from '../../shared/turbo/data-access/turbo-json.store.ts';
import { toAtomSlug } from '../../sync/utils/atom-slug.util.ts';
import type { ExecArgs, ExecDeps, PlaywrightTestRun, SlugPaths } from '../common/exec.type.ts';
import { readCountFile } from '../data-access/count-file.store.ts';
import { packageFileExists } from '../data-access/package-file.store.ts';
import { runPlaywrightTest } from '../data-access/playwright-test.process.ts';
import { resetSlugDir, writeTestList } from '../data-access/slug-dir.store.ts';
import { parseAtomizerArgs } from '../utils/atomizer-args.util.ts';
import { parseExecArgv } from '../utils/exec-argv.util.ts';
import { toExitCode } from '../utils/exit-code.util.ts';
import { toPlaywrightTestArgs, toPlaywrightTestEnv } from '../utils/playwright-test-run.util.ts';
import { zeroTestVerdict } from '../utils/zero-test-guard.util.ts';

type SlugRun = {
  readonly cwd: string;
  readonly execArgs: ExecArgs;
  readonly paths: SlugPaths;
  readonly countReporterPath: string;
};

const failExec = (message: string): number => {
  process.stderr.write(`turbo-atomizer exec: ${message}\n`);

  return 1;
};

const failInvalidAtomizerArgs = (value: string | undefined): number => {
  return failExec(`${TURBO_ATOMIZER_ARGS_ENV} is not a JSON array of strings: ${String(value)}`);
};

const failCommaReporterPath = (countReporterPath: string): number => {
  return failExec(
    `the counting reporter path ${countReporterPath} contains a comma, which Playwright's --add-reporter splits on; install turbo-atomizer under a path without commas`
  );
};

const findConfigFile = (cwd: string, execArgs: ExecArgs): string | undefined => {
  const configFile = execArgs.configFile;

  if (configFile === undefined) return findPlaywrightConfig(cwd);

  const exists = packageFileExists(cwd, configFile);

  return exists ? configFile : undefined;
};

/** Spec §6.3 step 1: turbo also schedules the generated package's copy of a file task; that copy exits 0 without running. */
const skipGeneratedCopy = async (cwd: string, taskPath: string): Promise<number> => {
  const turboJson = await readTurboJson(cwd);
  const tags = turboJson?.content.tags ?? [];
  const isGeneratedPackage = tags.includes(ATOMIZER_DEFINITIONS_TAG);

  if (!isGeneratedPackage) return failExec(`no Playwright config in ${cwd}; run from the test package`);

  process.stdout.write(
    `turbo-atomizer: skipped ${taskPath} in the generated package; add --filter=<test package> to avoid scheduling it\n`
  );

  return 0;
};

const runPlaywright = async (run: SlugRun, leaseEnv: Record<string, string>): Promise<number> => {
  await writeTestList(run.paths, run.execArgs.listLine);

  const args = toPlaywrightTestArgs(run.execArgs, run.paths, run.countReporterPath);
  const env = toPlaywrightTestEnv(process.env, leaseEnv, run.paths);
  const testRun: PlaywrightTestRun = { args, cwd: run.cwd, env };
  const exit = await runPlaywrightTest(testRun);

  return toExitCode(exit.code, exit.signal, constants.signals);
};

const guardZeroTests = async (run: SlugRun): Promise<number> => {
  const count = await readCountFile(run.paths.count);
  const verdict = zeroTestVerdict(count, run.execArgs.hasFilter);

  if (verdict === 'missing') return failExec(`the counting reporter wrote no count file at ${run.paths.count}`);

  if (verdict === 'empty') return failExec(`no tests selected for ${run.execArgs.taskPath}; run turbo-atomizer sync`);

  return 0;
};

/** Spec §6.3: runs one spec file's Playwright run in the test package `cwd` and returns the exit code. */
export const runExec = async (argv: string[], cwd: string, deps: ExecDeps): Promise<number> => {
  const envArgs = parseAtomizerArgs(deps.atomizerArgs);
  const execArgs = parseExecArgv(argv, envArgs ?? []);
  const configFile = findConfigFile(cwd, execArgs);

  if (configFile === undefined) return skipGeneratedCopy(cwd, execArgs.taskPath);

  if (envArgs === undefined) return failInvalidAtomizerArgs(deps.atomizerArgs);

  const hasCommaReporterPath = deps.countReporterPath.includes(',');

  if (hasCommaReporterPath) return failCommaReporterPath(deps.countReporterPath);

  const hasTaskFile = packageFileExists(cwd, execArgs.taskPath);

  if (!hasTaskFile) return failExec(`${execArgs.taskPath} does not exist; run turbo-atomizer sync`);

  const slug = toAtomSlug(execArgs.taskPath);
  const paths = await resetSlugDir(cwd, slug);
  const run: SlugRun = { cwd, execArgs, paths, countReporterPath: deps.countReporterPath };
  const lease = await deps.ensureServer(cwd, configFile);

  try {
    const exitCode = await runPlaywright(run, lease.env);

    if (exitCode !== 0) return exitCode;

    return await guardZeroTests(run);
  } finally {
    lease.release();
  }
};
