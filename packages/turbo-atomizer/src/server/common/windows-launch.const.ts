export const POWERSHELL_EXE = 'powershell.exe';

/** Lets a hung WMI call fail the exec instead of stalling it. */
export const WINDOWS_LAUNCH_TIMEOUT_MS = 30_000;

/**
 * Reads `{ commandLine, cwd, env }` as ASCII JSON from stdin, so the env never shows in a command line, and prints
 * `{ returnValue, processId }`. `EnvironmentVariables` replaces the new process's env rather than adding to it.
 */
const LAUNCH_STATEMENTS = [
  "$ErrorActionPreference = 'Stop'",
  '$request = [Console]::In.ReadToEnd() | ConvertFrom-Json',
  '$startupProperties = @{ EnvironmentVariables = [string[]]$request.env; ShowWindow = [uint16]0 }',
  '$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property $startupProperties',
  '$arguments = @{ CommandLine = $request.commandLine; CurrentDirectory = $request.cwd; ProcessStartupInformation = $startup }',
  '$created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments $arguments',
  '$result = @{ returnValue = [int]$created.ReturnValue; processId = [int]$created.ProcessId }',
  '[Console]::Out.Write((ConvertTo-Json -Compress -InputObject $result))'
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
