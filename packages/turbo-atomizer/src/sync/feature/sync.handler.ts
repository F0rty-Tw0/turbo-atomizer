import type { SyncOptions } from '../common/sync.type.ts';
import { syncPackage } from '../domain-logic/sync.ts';
import { formatSyncError, formatSyncResult } from '../utils/sync-summary.util.ts';

const syncOne = async (packageDir: string, options: SyncOptions): Promise<number> => {
  try {
    const result = await syncPackage(packageDir, options);
    const summary = formatSyncResult(packageDir, result);

    process.stdout.write(summary);

    return result.stale ? 1 : 0;
  } catch (error) {
    const line = formatSyncError(packageDir, error);

    process.stderr.write(line);

    return 1;
  }
};

/** Syncs each package in order; 1 when any package is stale under `check` or fails, else 0. */
export const syncHandler = async (packageDirs: string[], options: SyncOptions): Promise<number> => {
  let exitCode = 0;

  for (const packageDir of packageDirs) {
    const packageExitCode = await syncOne(packageDir, options);

    exitCode = Math.max(exitCode, packageExitCode);
  }

  return exitCode;
};
