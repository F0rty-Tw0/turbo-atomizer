import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const noLog = (): string => '';

/** How many times a fixture server started: lines in `<root>/.atomizer/<logName>.log`, 0 when the log is missing. */
export const startCount = async (root: string, logName: string): Promise<number> => {
  const path = join(root, '.atomizer', `${logName}.log`);
  const text = await readFile(path, 'utf8').catch(noLog);
  const lines = text.split('\n').filter(Boolean);

  return lines.length;
};
