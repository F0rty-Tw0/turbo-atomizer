import type { SpawnSyncReturns } from 'node:child_process';

export type ReleaseScenario = {
  readonly changelog: () => string;
  readonly commit: (subject: string) => void;
  readonly dispose: () => void;
  readonly githubOutput: () => string;
  readonly run: (...args: string[]) => SpawnSyncReturns<string>;
  readonly tags: () => string[];
  readonly version: () => string;
};
