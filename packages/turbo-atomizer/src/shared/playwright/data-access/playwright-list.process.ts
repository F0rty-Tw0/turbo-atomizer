import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolvePlaywrightBin } from './playwright-bin.path.ts';
import { TURBO_ATOMIZER_DESCRIBE_ENV, TURBO_ATOMIZER_ENV } from '../../atomizer/common/atomizer.const.ts';
import { PlaywrightListException } from '../common/playwright-list.exception.ts';
import { playwrightListReportSchema } from '../common/playwright-list.schema.ts';
import { PLAYWRIGHT_JSON_OUTPUT_FILE_ENV } from '../common/playwright.const.ts';
import type { ListSpecsOptions, SpecListing } from '../common/spec-listing.type.ts';
import { toSpecListing, toStderrTail } from '../utils/playwright-list-mapper.util.ts';

type ListRun = {
  readonly args: string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
};

const runList = async (run: ListRun): Promise<string> => {
  return new Promise((resolve, reject): void => {
    const child = spawn(process.execPath, run.args, { cwd: run.cwd, env: run.env, stdio: ['ignore', 'ignore', 'pipe'] });
    const chunks: Buffer[] = [];

    const settle = (code: number | null): void => {
      const stderr = Buffer.concat(chunks).toString('utf8');
      const stderrTail = toStderrTail(stderr);

      if (code === 0) return void resolve(stderr);

      reject(new PlaywrightListException(`exit code ${String(code)} in ${run.cwd}`, stderrTail));
    };

    child.stderr.on('data', (chunk: Buffer): number => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', settle);
  });
};

const testListArgs = (listFile: string, metadataOnly: boolean | undefined): string[] => {
  if (metadataOnly !== true) return [];

  return ['--test-list', listFile];
};

const readReport = async (reportFile: string, stderr: string): Promise<SpecListing> => {
  const text = await readFile(reportFile, 'utf8');
  const raw: unknown = JSON.parse(text);
  const parsed = playwrightListReportSchema.safeParse(raw);

  if (!parsed.success)
    throw new PlaywrightListException(`unreadable JSON report: ${parsed.error.message}`, toStderrTail(stderr), {
      cause: parsed.error
    });

  return toSpecListing(parsed.data);
};

/**
 * Runs `playwright test --list --reporter=json` in `packageDir` with the describe env set.
 * The report goes to a temp file, not stdout, so a config that prints (dotenv) cannot corrupt it.
 * `metadataOnly` adds an empty `--test-list`, so no spec file is loaded.
 * `--pass-with-no-tests` keeps a package without specs listable; Playwright exits 1 with "No tests found" otherwise.
 */
export const listSpecs = async (packageDir: string, configFile: string, options: ListSpecsOptions = {}): Promise<SpecListing> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'turbo-atomizer-list-'));
  const reportFile = join(tempDir, 'report.json');
  const listFile = join(tempDir, 'test-list.txt');
  const bin = resolvePlaywrightBin(packageDir);
  const listArgs = testListArgs(listFile, options.metadataOnly);
  const args = [bin, 'test', '--list', '--reporter=json', '--pass-with-no-tests', `--config=${configFile}`, ...listArgs];
  const extraEnv = options.extraEnv ?? {};
  const env = {
    ...process.env,
    [TURBO_ATOMIZER_ENV]: '1',
    [TURBO_ATOMIZER_DESCRIBE_ENV]: '1',
    ...extraEnv,
    [PLAYWRIGHT_JSON_OUTPUT_FILE_ENV]: reportFile
  };
  const run: ListRun = { args, cwd: packageDir, env };

  try {
    await writeFile(listFile, '');

    const stderr = await runList(run);

    return await readReport(reportFile, stderr);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
};
