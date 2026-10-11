import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import { promisify } from 'node:util';

import { descendantPids } from './windows-processes.spec.util.ts';
import { runChecked } from './workspace-command.spec.util.ts';
import { TEST_PACKAGE_DIR } from '../common/fixture-workspace.const.ts';
import type { FixtureWorkspace } from '../common/fixture-workspace.type.ts';
import { jsonObjectSchema } from '../common/turbo-summary.schema.ts';
import type { TurboRunSnapshot, WindowsProcess } from '../common/workspace-process.type.ts';

const execFileAsync = promisify(execFile);

const CONFIG_PATH = `${TEST_PACKAGE_DIR}/turbo-atomizer.json`;

const SUPERVISOR_ENTRY = 'supervisor.js';

const TURBO_EXE = 'turbo.exe';

/** Playwright's Chromium is `chrome-headless-shell.exe` (CI installs `--only-shell`) or `headless_shell.exe`. */
const BROWSER_MARK = 'headless';

/** `taskkill /F` on `pid`, and on its whole process tree when `tree` is set. */
export const taskkill = async (pid: number, tree: boolean): Promise<void> => {
  const args = ['/PID', String(pid), '/F'];

  if (tree) args.push('/T');

  await execFileAsync('taskkill', args, { windowsHide: true });
};

/** Sets `server.idleMs` in the test package's config, syncs and commits, so the supervisor outlives the gaps between runs. */
export const setServerIdleMs = async (workspace: FixtureWorkspace, idleMs: number): Promise<void> => {
  const text = await workspace.read(CONFIG_PATH);
  const raw: unknown = JSON.parse(text);
  const config = jsonObjectSchema.parse(raw);
  const server = { idleMs };
  const updated = { ...config, server };

  await workspace.edit(CONFIG_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  await runChecked(workspace.root, 'turbo-atomizer sync');
  await workspace.commit('server idle');
};

/** The supervisors of `root`: `node <package>/supervisor.js <package dir> <config file>`, both paths inside `root`. */
export const supervisorsOf = (processes: WindowsProcess[], root: string): WindowsProcess[] => {
  const name = basename(root);

  return processes.filter((entry): boolean => entry.commandLine.includes(SUPERVISOR_ENTRY) && entry.commandLine.includes(name));
};

/** `pid`'s descendants minus every supervisor among them and the supervisor's own tree, which outlives turbo by design. */
export const runDescendants = (processes: WindowsProcess[], pid: number, root: string): WindowsProcess[] => {
  const supervisorPids = supervisorsOf(processes, root).map((entry): number => entry.pid);
  const supervisorTrees = supervisorPids.flatMap((supervisorPid): number[] => descendantPids(processes, supervisorPid));
  const excluded = new Set([...supervisorPids, ...supervisorTrees]);
  const descendants = new Set(descendantPids(processes, pid));

  return processes.filter((entry): boolean => descendants.has(entry.pid) && !excluded.has(entry.pid));
};

/** Entries of `snapshot` still running in `processes`: same pid and command line, so a reused pid does not count. */
export const survivorsOf = (snapshot: WindowsProcess[], processes: WindowsProcess[]): WindowsProcess[] => {
  const running = new Set(processes.map((entry): string => `${String(entry.pid)} ${entry.commandLine}`));

  return snapshot.filter((entry): boolean => running.has(`${String(entry.pid)} ${entry.commandLine}`));
};

/** turbo.exe under `shellPid` and its run's processes, once a headless browser runs among them; undefined until then. */
export const browserRunSnapshot = (processes: WindowsProcess[], shellPid: number, root: string): TurboRunSnapshot | undefined => {
  const shellTree = new Set(descendantPids(processes, shellPid));
  const turbo = processes.find((entry): boolean => shellTree.has(entry.pid) && entry.name.toLowerCase() === TURBO_EXE);

  if (turbo === undefined) return undefined;

  const descendants = runDescendants(processes, turbo.pid, root);
  const hasBrowser = descendants.some((entry): boolean => entry.name.includes(BROWSER_MARK));

  if (!hasBrowser) return undefined;

  const snapshot: TurboRunSnapshot = { turboPid: turbo.pid, processes: descendants };

  return snapshot;
};

/** Length of the longest command line containing `needle`; undefined when none runs. */
export const longestCommandLine = (processes: WindowsProcess[], needle: string): number | undefined => {
  const matching = processes.filter((entry): boolean => entry.commandLine.includes(needle));
  const lengths = matching.map((entry): number => entry.commandLine.length);

  if (lengths.length === 0) return undefined;

  return Math.max(...lengths);
};
