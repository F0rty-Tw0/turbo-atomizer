/** One task of a package, as `turbo query` lists it. */
export type QueriedTask = {
  readonly name: string;
  readonly tags: string[];
};

/** A package's own tags and its tasks, as `turbo query` lists them. */
export type QueriedPackage = {
  readonly tags: string[];
  readonly tasks: QueriedTask[];
};
