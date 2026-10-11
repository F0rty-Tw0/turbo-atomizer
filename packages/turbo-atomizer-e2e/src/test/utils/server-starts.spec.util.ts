import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const LOG_DIR = '.atomizer';

const LOG_SUFFIX = '.log';

const noLog = (): string => '';

const noLogs = (): string[] => [];

const isLogName = (name: string): boolean => name.endsWith(LOG_SUFFIX);

/** Pids a fixture server appended to `<root>/.atomizer/<logName>.log`, one per start, oldest first; [] when the log is missing. */
export const startedPids = async (root: string, logName: string): Promise<number[]> => {
  const path = join(root, LOG_DIR, `${logName}${LOG_SUFFIX}`);
  const text = await readFile(path, 'utf8').catch(noLog);
  const lines = text.split('\n').filter(Boolean);

  return lines.map(Number);
};

/** How many times a fixture server started: lines in `<root>/.atomizer/<logName>.log`, 0 when the log is missing. */
export const startCount = async (root: string, logName: string): Promise<number> => {
  const pids = await startedPids(root, logName);

  return pids.length;
};

/** Every pid any fixture server of `root` logged on start, whether or not it still runs. */
export const loggedServerPids = async (root: string): Promise<number[]> => {
  const names = await readdir(join(root, LOG_DIR)).catch(noLogs);
  const logNames = names.filter(isLogName).map((name): string => name.slice(0, -LOG_SUFFIX.length));
  const pids = await Promise.all(logNames.map(async (logName): Promise<number[]> => startedPids(root, logName)));

  return pids.flat();
};
