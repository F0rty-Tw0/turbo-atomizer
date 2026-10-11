import type { SpawnSyncReturns } from 'node:child_process';

export type ReleaseScenario = {
  readonly dispose: () => void;
  readonly run: (...args: string[]) => SpawnSyncReturns<string>;
  readonly version: () => string;
};
