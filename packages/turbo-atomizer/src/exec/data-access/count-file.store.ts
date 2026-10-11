import { readFile, writeFile } from 'node:fs/promises';

import { z } from 'zod';

import type { SelectedCount } from '../common/exec.type.ts';

const selectedField = z.int().nonnegative();

const selectedCountSchema = z.object({
  selected: selectedField
});

export const writeCountFile = async (file: string, selected: number): Promise<void> => {
  const count: SelectedCount = { selected };

  await writeFile(file, JSON.stringify(count));
};

const parseCount = (text: string): unknown => {
  try {
    const raw: unknown = JSON.parse(text);

    return raw;
  } catch {
    return undefined;
  }
};

/** Returns the recorded count, or `undefined` when the file is absent or unreadable. */
export const readCountFile = async (file: string): Promise<SelectedCount | undefined> => {
  const text = await readFile(file, 'utf8').catch((): undefined => undefined);

  if (text === undefined) return undefined;

  const raw = parseCount(text);
  const parsed = selectedCountSchema.safeParse(raw);

  return parsed.data;
};
