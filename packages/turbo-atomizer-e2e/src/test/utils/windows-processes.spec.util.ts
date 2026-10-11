import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { win32ProcessListSchema } from '../common/workspace-process.schema.ts';
import type { Win32Process, WindowsProcess } from '../common/workspace-process.type.ts';

const execFileAsync = promisify(execFile);

const LIST_SCRIPT =
  'ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine)';

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

const toWindowsProcess = (row: Win32Process): WindowsProcess => {
  const entry: WindowsProcess = {
    pid: row.ProcessId,
    parentPid: row.ParentProcessId,
    name: row.Name,
    commandLine: row.CommandLine ?? ''
  };

  return entry;
};

/** Every process on this Windows machine, from `Get-CimInstance Win32_Process`. Windows only. */
export const windowsProcesses = async (): Promise<WindowsProcess[]> => {
  const args = ['-NoProfile', '-NonInteractive', '-Command', LIST_SCRIPT];
  const { stdout } = await execFileAsync('powershell.exe', args, { maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true });
  const raw: unknown = JSON.parse(stdout);
  const rows = win32ProcessListSchema.parse(raw);

  return rows.map(toWindowsProcess);
};
