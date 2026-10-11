export type TurboExit = {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
};
