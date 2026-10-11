export type FixtureCopy = {
  readonly directory: string;
  readonly dispose: () => Promise<void>;
};
