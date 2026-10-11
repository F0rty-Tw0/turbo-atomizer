import { ServerFailedException } from '../common/server-failed.exception.ts';
import { SUPERVISOR_SPAWN_FLAG } from '../common/server.const.ts';
import type { SupervisorStart, Win32CreateResult, WindowsLaunch } from '../common/server.type.ts';
import {
  LAUNCH_FIELD_SEPARATOR,
  OUTSIDE_JOB_REASON,
  UNDOCUMENTED_CREATE_FAILURE,
  WIN32_CREATE_FAILURES
} from '../common/windows-launch.const.ts';

type EnvEntry = [string, string | undefined];

type SetEnvEntry = [string, string];

const BACKSLASHES_BEFORE_QUOTE = /(\\*)"/g;

const TRAILING_BACKSLASHES = /(\\+)$/;

/** `launch` as the launch script reads it from stdin: command line, cwd, then each env entry, NUL-separated (none can hold a NUL). */
export const toLaunchStdin = (launch: WindowsLaunch): string => {
  const fields = [launch.commandLine, launch.cwd, ...launch.env];

  return fields.join(LAUNCH_FIELD_SEPARATOR);
};

/** `arg` as one CommandLineToArgvW argument: quoted, each quote escaped, and backslashes doubled only before a quote. */
export const quoteWindowsArg = (arg: string): string => {
  const quotesEscaped = arg.replace(BACKSLASHES_BEFORE_QUOTE, '$1$1\\"');
  const escaped = quotesEscaped.replace(TRAILING_BACKSLASHES, '$1$1');

  return `"${escaped}"`;
};

/** Windows keeps per-drive cwds as hidden `=C:` entries, which are not variables a child can be given. */
const isSettable = (entry: EnvEntry): entry is SetEnvEntry => {
  const [name, value] = entry;
  const isHidden = name.startsWith('=');

  return value !== undefined && name !== '' && !isHidden;
};

const toEnvString = ([name, value]: SetEnvEntry): string => `${name}=${value}`;

/** `env` as `Win32_ProcessStartup.EnvironmentVariables` entries (`NAME=value`). */
export const toEnvironmentStrings = (env: NodeJS.ProcessEnv): string[] => {
  const entries: EnvEntry[] = Object.entries(env);

  return entries.filter(isSettable).map(toEnvString);
};

/** The launcher `Win32_Process.Create` starts in the package dir: the supervisor entry with `--spawn`, given `env` whole. */
export const toSupervisorLaunch = (start: SupervisorStart, env: NodeJS.ProcessEnv): WindowsLaunch => {
  const args = [start.execPath, start.supervisorPath, SUPERVISOR_SPAWN_FLAG, start.packageDir, start.configFile];
  const commandLine = args.map(quoteWindowsArg).join(' ');
  const environment = toEnvironmentStrings(env);
  const launch: WindowsLaunch = { commandLine, cwd: start.packageDir, env: environment };

  return launch;
};

/** The pid `Win32_Process.Create` reported, or a failure naming its return value. */
export const createdPid = (result: Win32CreateResult): number => {
  if (result.returnValue === 0) return result.processId;

  const meaning = WIN32_CREATE_FAILURES[result.returnValue] ?? UNDOCUMENTED_CREATE_FAILURE;
  const details = `${OUTSIDE_JOB_REASON}: Win32_Process.Create returned ${String(result.returnValue)} (${meaning})`;

  throw new ServerFailedException(details, '');
};
