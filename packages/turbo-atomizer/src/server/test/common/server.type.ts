export type StaticServer = {
  readonly pid: number;
  readonly port: number;
  readonly stop: () => Promise<void>;
};
