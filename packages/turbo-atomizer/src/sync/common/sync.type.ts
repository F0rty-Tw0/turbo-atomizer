import type { AtomsDiff } from './atoms-diff.type.ts';

export type SyncOptions = {
  readonly check: boolean;
};

export type SyncResult = {
  readonly diff: AtomsDiff;
  readonly stale: boolean;
  readonly written: boolean;
};
