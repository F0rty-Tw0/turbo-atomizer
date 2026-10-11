/** A workspace package with the task names turbo knows for it (scripts and configured tasks). `dir` is relative to the workspace root, posix. */
export type PackageTasks = {
  readonly name: string;
  readonly dir: string;
  readonly tasks: string[];
};
