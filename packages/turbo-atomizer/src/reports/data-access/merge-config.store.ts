import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MERGE_CONFIG_FILE } from '../common/reports.const.ts';

/** Writes the temporary merge config into `configDir` and returns its path. */
export const writeMergeConfig = async (configDir: string, text: string): Promise<string> => {
  const path = join(configDir, MERGE_CONFIG_FILE);

  await writeFile(path, text);

  return path;
};

export const removeMergeConfig = async (path: string): Promise<void> => rm(path, { force: true });
