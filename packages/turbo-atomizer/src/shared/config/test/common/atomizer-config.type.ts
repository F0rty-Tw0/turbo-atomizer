export type TempConfigPackage = {
  readonly directory: string;
  readonly dispose: () => Promise<void>;
};
