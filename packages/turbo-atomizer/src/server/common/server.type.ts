import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

import type { WebServerFact } from '../../shared/atomizer/common/atomizer.type.ts';

export type GracefulShutdown = {
  readonly signal: NodeJS.Signals;
  readonly timeout: number;
};

export type LockOwner = {
  readonly pid: number;
  readonly startTime: string;
};

export type ServerChild = ChildProcessByStdio<null, Readable, Readable>;

export type RunningServer = {
  readonly child: ServerChild;
  readonly fact: WebServerFact;
};

type ReadyOutcome = {
  readonly ok: true;
  readonly env: Record<string, string>;
};

type FailedOutcome = {
  readonly ok: false;
  readonly message: string;
  readonly logTail: string;
};

type LaunchedServer = {
  readonly server: RunningServer | undefined;
};

type StartedServers = {
  readonly servers: RunningServer[];
};

export type LaunchOutcome = (ReadyOutcome | FailedOutcome) & LaunchedServer;

export type StartOutcome = (ReadyOutcome | FailedOutcome) & StartedServers;

export type SupervisorLoopOptions = {
  readonly packageDir: string;
  readonly configFile: string;
  readonly idleMs: number;
  readonly log: Writable;
  readonly startupFailure: string | undefined;
  readonly token: string;
};

/** The supervisor `startSupervisor` starts: `<execPath> <supervisorPath> <packageDir> <configFile>`. */
export type SupervisorStart = {
  readonly execPath: string;
  readonly supervisorPath: string;
  readonly packageDir: string;
  readonly configFile: string;
};

/** What `Win32_Process.Create` starts: the command line holds only paths and flags, the whole env travels apart from it. */
export type WindowsLaunch = {
  readonly commandLine: string;
  readonly cwd: string;
  readonly env: string[];
};

export type Win32CreateResult = {
  readonly returnValue: number;
  readonly processId: number;
};
