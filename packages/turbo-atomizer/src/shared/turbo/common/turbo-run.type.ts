export type TurboExit = {
  readonly code: number | null;
  /** The SIGINT or SIGTERM this process forwarded while turbo ran; on Ctrl+C turbo shuts its tasks down and still exits 0. */
  readonly interrupt: NodeJS.Signals | null;
  readonly signal: NodeJS.Signals | null;
};
