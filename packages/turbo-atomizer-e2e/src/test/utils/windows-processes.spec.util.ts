import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { win32ProcessListSchema } from '../common/workspace-process.schema.ts';
import type { Win32Process, WindowsProcess } from '../common/workspace-process.type.ts';

const execFileAsync = promisify(execFile);

/** `CreationDate` as Unix ms, 0 when Windows reports none (System Idle Process), so the JSON holds a plain number. */
const CREATION_DATE =
  "@{n='CreationDate';e={if ($_.CreationDate) {([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds()} else {0}}}";

const LIST_SCRIPT = `ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine,${CREATION_DATE})`;

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

const toWindowsProcess = (row: Win32Process): WindowsProcess => {
  const entry: WindowsProcess = {
    pid: row.ProcessId,
    parentPid: row.ParentProcessId,
    name: row.Name,
    commandLine: row.CommandLine ?? '',
    createdAt: row.CreationDate
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

/**
 * Whether `entry` is a child of `parent`: it names `parent` as its parent and started after it, so a stale orphan whose
 * dead parent's pid was reused does not count.
 */
const isChildOf = (entry: WindowsProcess, parent: WindowsProcess): boolean =>
  entry.parentPid === parent.pid && entry.createdAt >= parent.createdAt;

/** Pids of `pid`'s descendants, found by walking `ParentProcessId` links in one snapshot; a reused pid cannot loop it. */
export const descendantPids = (processes: WindowsProcess[], pid: number): number[] => {
  const found = new Set<number>();
  let parents = processes.filter((entry): boolean => entry.pid === pid);

  while (parents.length > 0) {
    const current = parents;

    const isNewChild = (entry: WindowsProcess): boolean =>
      entry.pid !== pid && !found.has(entry.pid) && current.some((parent): boolean => isChildOf(entry, parent));

    parents = processes.filter(isNewChild);
    parents.forEach((child): void => void found.add(child.pid));
  }

  return [...found];
};
