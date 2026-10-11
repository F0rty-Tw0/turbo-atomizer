import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const readTextOrEmpty = async (filePath: string): Promise<string> => {
  const exists = existsSync(filePath);

  if (!exists) return '';

  return readFile(filePath, 'utf8');
};

/** Appends each of `lines` that `.gitignore` in `root` does not already hold, creating the file when absent (init step 9). */
export const ensureGitignoreLines = async (root: string, lines: string[]): Promise<boolean> => {
  const filePath = join(root, '.gitignore');
  const text = await readTextOrEmpty(filePath);
  const present = new Set(text.split(/\r?\n/).map((line) => line.trim()));
  const missing = lines.filter((line) => !present.has(line));

  if (missing.length === 0) return false;

  const needsNewline = text !== '' && !text.endsWith('\n');
  const separator = needsNewline ? '\n' : '';
  const addition = missing.map((line) => `${line}\n`).join('');

  await writeFile(filePath, `${text}${separator}${addition}`);

  return true;
};
