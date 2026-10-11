import { spawn } from 'node:child_process';

import { resolvePlaywrightBin } from './playwright-bin.path.ts';
import { PLAYWRIGHT_HTML_OPEN_ENV } from '../common/playwright.const.ts';

/**
 * Runs `playwright merge-reports <blobDir> --config <configPath>` in `packageDir` with inherited stdio.
 * The HTML report never opens: a CLI that waits on a served report would hang CI and scripts.
 * Returns the exit code; a death by signal counts as 1.
 */
export const runPlaywrightMerge = async (packageDir: string, blobDir: string, configPath: string): Promise<number> => {
  const bin = resolvePlaywrightBin(packageDir);
  const args = [bin, 'merge-reports', blobDir, '--config', configPath];
  const env = { ...process.env, [PLAYWRIGHT_HTML_OPEN_ENV]: 'never' };

  return new Promise((resolve, reject): void => {
    const child = spawn(process.execPath, args, { cwd: packageDir, env, stdio: 'inherit' });

    child.on('error', reject);
    child.on('close', (code: number | null): void => resolve(code ?? 1));
  });
};
