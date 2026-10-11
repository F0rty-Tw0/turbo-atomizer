import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Returns the generated package's `turbo.json` text with LF line endings, or `undefined` before the first sync. A checkout
 * with `core.autocrlf` (the Windows default) turns the LF that sync writes into CRLF, which must not read as stale.
 */
export const readAtomsFile = async (filePath: string): Promise<string | undefined> => {
  const exists = existsSync(filePath);

  if (!exists) return undefined;

  const text = await readFile(filePath, 'utf8');

  return text.replaceAll('\r\n', '\n');
};

export const writeAtomsFile = async (filePath: string, text: string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, text);
};
