export type AtomizerEnv = {
  readonly active: boolean;
  readonly args: string | undefined;
  readonly captureServerEnv: boolean;
  readonly countFile: string | undefined;
  readonly describe: boolean;
};

export type RegexFact = {
  readonly flags: string;
  readonly source: string;
};

type GracefulShutdownFact = {
  readonly signal: 'SIGINT' | 'SIGTERM';
  readonly timeout: number;
};

export type WaitFact = {
  readonly stderr?: RegexFact | undefined;
  readonly stdout?: RegexFact | undefined;
};

export type WebServerFact = {
  readonly command: string;
  readonly cwd?: string | undefined;
  readonly env?: Record<string, string> | undefined;
  readonly gracefulShutdown?: GracefulShutdownFact | undefined;
  readonly ignoreHTTPSErrors?: boolean | undefined;
  readonly port?: number | undefined;
  readonly timeout?: number | undefined;
  readonly url?: string | undefined;
  readonly wait?: WaitFact | undefined;
};

export type AtomizerMetadata = {
  readonly reporters: [string, unknown][];
  readonly serverEnv?: Record<string, string>;
  readonly setupProjects: string[];
  readonly snapshotDirs: (string | null)[];
  readonly snapshotPathTemplates: (string | null)[];
  readonly version: 1;
  readonly webServers: WebServerFact[];
};
