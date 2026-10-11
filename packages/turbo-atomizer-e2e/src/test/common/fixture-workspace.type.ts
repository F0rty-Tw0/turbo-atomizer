export type FixtureName = 'npm-basic' | 'pnpm-basic' | 'two-servers';

export type PackageManager = 'npm' | 'pnpm';

/** A fixture installed with one package manager; the regression journey runs once per case. */
export type FixtureCase = {
  readonly fixture: FixtureName;
  readonly pm: PackageManager;
};

/** The `ATOMIZER_E2E_*` settings of this run; undefined means unset. */
export type E2eEnv = {
  readonly pm: PackageManager | undefined;
  readonly turboVersion: string | undefined;
};

export type CommandEnv = Record<string, string>;

export type RunResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
};

/** A command started in the background; `pid` is the shell's (0 when the spawn failed, and `result` rejects). */
export type RunningCommand = {
  readonly pid: number;
  readonly result: Promise<RunResult>;
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
