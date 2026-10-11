import type { ServerLease } from '../../shared/server/common/server-lease.type.ts';

export type ExecArgs = {
  readonly taskPath: string;
  readonly listLine: string;
  readonly needsBlob: boolean;
  readonly configFile: string | undefined;
  readonly playwrightArgs: string[];
  readonly forwardedReporters: string[];
  readonly hasFilter: boolean;
};

export type ExecDeps = {
  readonly ensureServer: (packageDir: string, configFile: string) => Promise<ServerLease>;
  readonly countReporterPath: string;
  /** Raw `TURBO_ATOMIZER_ARGS`; `undefined` when unset. */
  readonly atomizerArgs: string | undefined;
};

export type SelectedCount = {
  readonly selected: number;
};

export type SignalNumbers = Partial<Record<NodeJS.Signals, number>>;

export type ZeroTestVerdict = 'ok' | 'missing' | 'empty';

/** Absolute paths inside `.atomizer/<slug>/`. */
export type SlugPaths = {
  readonly dir: string;
  readonly testList: string;
  readonly testResults: string;
  readonly blob: string;
  readonly html: string;
  readonly json: string;
  readonly junit: string;
  readonly count: string;
};

export type PlaywrightTestRun = {
  readonly args: string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
};

export type PlaywrightExit = {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
};
