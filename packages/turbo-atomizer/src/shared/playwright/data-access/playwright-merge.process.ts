import { spawn } from 'node:child_process';

import { resolvePlaywrightBin } from './playwright-bin.path.ts';
import { toPlaywrightMergeEnv, toPlaywrightMergeExitCode } from '../utils/playwright-merge-run.util.ts';

/**
 * Runs `playwright merge-reports <blobDir> --config <configPath>` in `packageDir` with inherited stdio.
 * The HTML report never opens and a death by signal counts as 1 (see `playwright-merge-run.util.ts`).
 * Returns the exit code.
 */
export const runPlaywrightMerge = async (packageDir: string, blobDir: string, configPath: string): Promise<number> => {
  const bin = resolvePlaywrightBin(packageDir);
  const args = [bin, 'merge-reports', blobDir, '--config', configPath];
  const env = toPlaywrightMergeEnv(process.env);

  return new Promise((resolve, reject): void => {
    const child = spawn(process.execPath, args, { cwd: packageDir, env, stdio: 'inherit' });

    child.on('error', reject);
    child.on('close', (code: number | null): void => resolve(toPlaywrightMergeExitCode(code)));
  });
};
