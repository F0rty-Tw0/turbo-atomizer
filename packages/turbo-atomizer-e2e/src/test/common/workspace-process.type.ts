/** A running process; `cwd` is '' where the platform does not expose it (macOS `ps`, Windows). */
export type ProcessEntry = {
  readonly pid: number;
  readonly commandLine: string;
  readonly cwd: string;
};

/**
 * One row of `Get-CimInstance Win32_Process`; `commandLine` is '' when Windows hides it. `createdAt` is the start time in
 * Unix ms, 0 when Windows reports none, so a child that predates its parent pid's process is told apart as a stale orphan.
 */
export type WindowsProcess = {
  readonly pid: number;
  readonly parentPid: number;
  readonly name: string;
  readonly commandLine: string;
  readonly createdAt: number;
};

/** A raw `Win32_Process` row as PowerShell's `ConvertTo-Json` prints it. */
export type Win32Process = {
  readonly ProcessId: number;
  readonly ParentProcessId: number;
  readonly Name: string;
  readonly CommandLine: string | null;
  readonly CreationDate: number;
};

/** A `turbo run` caught mid-run: turbo.exe's pid and its descendants at that moment, supervisor trees left out. */
export type TurboRunSnapshot = {
  readonly turboPid: number;
  readonly processes: WindowsProcess[];
};
