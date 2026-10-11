import type { AtomsDiff } from '../common/atoms-diff.type.ts';
import type { SyncResult } from '../common/sync.type.ts';

const STALE_STATUS = 'stale; run turbo-atomizer sync and commit the result';

const statusOf = (result: SyncResult): string => {
  if (result.stale) return STALE_STATUS;

  if (result.written) return 'updated';

  return 'up to date';
};

const labelled = (label: string, names: string[]): string[] => names.map((name): string => `  ${label}: ${name}`);

const diffLines = (diff: AtomsDiff): string[] => {
  const addedLines = labelled('added', diff.added);
  const removedLines = labelled('removed', diff.removed);
  const changedLines = labelled('changed', diff.changed);

  return [...addedLines, ...removedLines, ...changedLines];
};

/** One status line per package, then its file tasks by change kind (spec §6.2 step 7). */
export const formatSyncResult = (packageDir: string, result: SyncResult): string => {
  const status = statusOf(result);
  const changeLines = diffLines(result.diff);
  const lines = [`${packageDir}: ${status}`, ...changeLines];

  return `${lines.join('\n')}\n`;
};

export const formatSyncError = (packageDir: string, error: unknown): string => {
  if (error instanceof Error) return `${packageDir}: ${error.message}\n`;

  return `${packageDir}: ${String(error)}\n`;
};
