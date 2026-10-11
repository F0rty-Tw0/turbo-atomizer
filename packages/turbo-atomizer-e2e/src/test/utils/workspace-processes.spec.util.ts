import { readFile, readdir, readlink } from 'node:fs/promises';
import { sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const POLL_MS = 250;

const isPidName = (name: string): boolean => /^\d+$/.test(name);

const isPid = (pid: number | null): pid is number => pid !== null;

const isInside = (path: string, root: string): boolean => path === root || path.startsWith(`${root}${sep}`);

const referencingPid = async (pid: string, root: string): Promise<number | null> => {
  try {
    const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8');
    const cwd = await readlink(`/proc/${pid}/cwd`);
    const isCwdInside = isInside(cwd, root);
    const namesRoot = cmdline.includes(root);
    const references = namesRoot || isCwdInside;

    if (!references) return null;

    return Number(pid);
  } catch {
    return null;
  }
};

/** Pids whose command line names `root` or whose cwd lies inside it. Reads `/proc`, so Linux only. */
const workspacePids = async (root: string): Promise<number[]> => {
  const names = await readdir('/proc');
  const pidNames = names.filter(isPidName);
  const pids = await Promise.all(pidNames.map(async (pid): Promise<number | null> => referencingPid(pid, root)));

  return pids.filter(isPid);
};

const killQuietly = (pid: number): void => {
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
