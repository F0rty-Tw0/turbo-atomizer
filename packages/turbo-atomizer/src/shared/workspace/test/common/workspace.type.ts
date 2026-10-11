export type StubCommand = {
  readonly directory: string;
  readonly callsFile: string;
  readonly dispose: () => Promise<void>;
};
