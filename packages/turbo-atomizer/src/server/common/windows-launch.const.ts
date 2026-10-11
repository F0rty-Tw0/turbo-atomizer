export const POWERSHELL_EXE = 'powershell.exe';

/** Lets a hung WMI call fail the exec instead of stalling it. */
export const WINDOWS_LAUNCH_TIMEOUT_MS = 30_000;

export const LAUNCH_FIELD_SEPARATOR = '\0';

/**
 * Reads the command line, cwd and env entries NUL-separated as UTF-8 from stdin, so the env never shows in a command line,
 * and prints `{ returnValue, processId }`. Plain .NET only, no cmdlets: turbo strips PSModulePath and
 * PSModuleAnalysisCachePath from a task's env, so a task's powershell spends ~22 s finding the first cmdlet it runs.
 * `EnvironmentVariables` replaces the new process's env rather than adding to it.
 */
const LAUNCH_STATEMENTS = [
  "$ErrorActionPreference = 'Stop'",
  '$stdin = [System.IO.StreamReader]::new([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)',
  '$commandLine, $cwd, $environment = $stdin.ReadToEnd().Split([char]0)',
  "$startup = ([wmiclass]'Win32_ProcessStartup').CreateInstance()",
  '$startup.ShowWindow = [uint16]0',
  '$startup.EnvironmentVariables = [string[]]$environment',
  "$created = ([wmiclass]'Win32_Process').Create($commandLine, $cwd, $startup)",
  "[Console]::Out.Write('{\"returnValue\":' + [int]$created.ReturnValue + ',\"processId\":' + [int]$created.ProcessId + '}')"
];

const LAUNCH_SCRIPT = LAUNCH_STATEMENTS.join('; ');

export const POWERSHELL_LAUNCH_ARGS = ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', LAUNCH_SCRIPT];

/** `Win32_Process.Create` return values other than 0 (success), as Microsoft documents them. */
export const WIN32_CREATE_FAILURES: Record<number, string> = {
  2: 'access denied',
  3: 'insufficient privilege',
  8: 'unknown failure',
  9: 'path not found',
  21: 'invalid parameter'
};

export const UNDOCUMENTED_CREATE_FAILURE = 'undocumented return value';

/** Why the supervisor needs WMI at all; every Windows launch failure starts with it. */
export const OUTSIDE_JOB_REASON = "could not start the supervisor outside turbo's task job (it kills detached children on exit)";
