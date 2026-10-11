/** The turbo calls `affected` makes, injected so domain logic is tested without spawning turbo. */
export type AffectedDeps = {
  readonly queryAffectedTasks: (root: string, task: string) => Promise<string[]>;
  readonly runTurbo: (root: string, args: string[]) => Promise<number>;
};
