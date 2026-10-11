import { execFile } from 'node:child_process';
import { readFile, readdir, readlink } from 'node:fs/promises';
import { basename, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';

import { loggedServerPids } from './server-starts.spec.util.ts';
import { windowsProcesses } from './windows-processes.spec.util.ts';
import type { ProcessEntry, WindowsProcess } from '../common/workspace-process.type.ts';

const execFileAsync = promisify(execFile);

const POLL_MS = 250;

const PS_LINE = /^\s*(\d+)\s+(.*)$/;

/** The fixtures' webServer entry, which logs its pid under `.atomizer/`. */
const SERVER_ENTRY = 'server.js';

const isPidName = (name: string): boolean => /^\d+$/.test(name);

const isEntry = (entry: ProcessEntry | null): entry is ProcessEntry => entry !== null;

const isInside = (path: string, root: string): boolean => path === root || path.startsWith(`${root}${sep}`);

const procEntry = async (pid: string): Promise<ProcessEntry | null> => {
  try {
    const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8');
    const cwd = await readlink(`/proc/${pid}/cwd`);
    const entry: ProcessEntry = { pid: Number(pid), commandLine: cmdline.replaceAll('\0', ' '), cwd };

    return entry;
  } catch {
    return null;
  }
};

/** Linux: `/proc`, which also gives each process's cwd. */
const procProcesses = async (): Promise<ProcessEntry[]> => {
  const names = await readdir('/proc');
  const entries = await Promise.all(names.filter(isPidName).map(procEntry));

  return entries.filter(isEntry);
};

const psEntry = (line: string): ProcessEntry | null => {
  const match = PS_LINE.exec(line);

  if (match === null) return null;

  const entry: ProcessEntry = { pid: Number(match[1]), commandLine: match[2] ?? '', cwd: '' };

  return entry;
};

/** macOS and other unixes without `/proc`. */
const psProcesses = async (): Promise<ProcessEntry[]> => {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,command=']);

  return stdout.split('\n').map(psEntry).filter(isEntry);
};

const fromWindows = (entry: WindowsProcess): ProcessEntry => {
  const converted: ProcessEntry = { pid: entry.pid, commandLine: entry.commandLine, cwd: '' };

  return converted;
};

const listProcesses = async (): Promise<ProcessEntry[]> => {
  const isLinux = process.platform === 'linux';
  const isWindows = process.platform === 'win32';

  if (isLinux) return procProcesses();

  if (!isWindows) return psProcesses();

  const entries = await windowsProcesses();

  return entries.map(fromWindows);
};

/** Whether `pid` runs: signal 0 checks without sending anything. */
export const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

/**
 * Pids that belong to `root`: a command line naming its unique dir name, a cwd inside it (Linux), or a fixture server
 * that logged its pid there and still runs (webServer commands use relative paths, so their command lines miss it).
 * A logged pid counts only while its command line runs `server.js`, so a process that reused the pid is left alone.
 */
const workspacePids = async (root: string): Promise<number[]> => {
  const name = basename(root);
  const entries = await listProcesses();
  const loggedPids = await loggedServerPids(root);
  const logged = new Set(loggedPids);
  const isLoggedServer = (entry: ProcessEntry): boolean => logged.has(entry.pid) && entry.commandLine.includes(SERVER_ENTRY);

  const isOwn = (entry: ProcessEntry): boolean =>
    entry.commandLine.includes(name) || isInside(entry.cwd, root) || isLoggedServer(entry);

  const ownPids = entries.filter(isOwn).map((entry): number => entry.pid);
  const pids = new Set(ownPids);

  pids.delete(process.pid);

  return [...pids];
};

/** Kills `pid` and ignores a process that has already exited. */
export const killQuietly = (pid: number): void => {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // the process exited after it was listed
  }
};

/** Waits up to `timeoutMs` for the supervisor and servers of `root` to stop on their own, then kills what is left. */
export const settleWorkspaceProcesses = async (root: string, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let pids = await workspacePids(root);
  let remainingMs = timeoutMs;

  while (pids.length > 0 && remainingMs > 0) {
    await sleep(POLL_MS);
    pids = await workspacePids(root);
    remainingMs = deadline - Date.now();
  }

  pids.forEach(killQuietly);
};
