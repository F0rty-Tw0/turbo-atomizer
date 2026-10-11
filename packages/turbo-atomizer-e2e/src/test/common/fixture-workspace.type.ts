export type FixtureName = 'pnpm-basic' | 'two-servers';

export type PackageManager = 'npm' | 'pnpm';

export type CommandEnv = Record<string, string>;

export type RunResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
};

/** Task id → hash, from `turbo run <task> --dry=json`. */
export type TaskHashes = Record<string, string>;

/** One task of a `--summarize` or `--dry=json` turbo run. `exitCode` and `durationMs` are null when the task did not execute. */
export type TaskRun = {
  readonly taskId: string;
  readonly hash: string;
  readonly cacheStatus: string;
  readonly inputs: string[];
  readonly exitCode: number | null;
  readonly durationMs: number | null;
};

/** Whether `summarizedRun` throws when the run summary lists no task; `optional` only where no task is expected to run. */
export type SummaryPolicy = 'required' | 'optional';

export type TurboRun = {
  readonly result: RunResult;
  readonly tasks: TaskRun[];
};

/** A fixture copied to a temp dir, installed and committed. Paths are relative to `root`, which is the workspace root. */
export type FixtureWorkspace = {
  readonly root: string;
  readonly run: (command: string, env?: CommandEnv) => Promise<RunResult>;
  readonly read: (path: string) => Promise<string>;
  readonly edit: (path: string, text: string) => Promise<void>;
  readonly remove: (path: string) => Promise<void>;
  readonly commit: (message: string) => Promise<void>;
  readonly taskHashes: () => Promise<TaskHashes>;
  readonly dispose: () => Promise<void>;
};
