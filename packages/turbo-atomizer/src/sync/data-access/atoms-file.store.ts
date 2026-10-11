import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Returns the generated package's `turbo.json` text, or `undefined` before the first sync. */
export const readAtomsFile = async (filePath: string): Promise<string | undefined> => {
  const exists = existsSync(filePath);

  if (!exists) return undefined;

  return readFile(filePath, 'utf8');
};

export const writeAtomsFile = async (filePath: string, text: string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, text);
};
