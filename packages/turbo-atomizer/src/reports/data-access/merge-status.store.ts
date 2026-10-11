import { readFile, writeFile } from 'node:fs/promises';

import { z } from 'zod';

import type { MergeStatus } from '../common/reports.type.ts';

const statusField = z.string().min(1);

const mergeStatusSchema = z.object({
  status: statusField
});

export const writeMergeStatus = async (file: string, status: string): Promise<void> => {
  const mergeStatus: MergeStatus = { status };

  await writeFile(file, JSON.stringify(mergeStatus));
};

const parseStatus = (text: string): unknown => {
  try {
    const raw: unknown = JSON.parse(text);

    return raw;
  } catch {
    return undefined;
  }
};

/** Returns the recorded status, or `undefined` when the file is absent or unreadable. */
export const readMergeStatus = async (file: string): Promise<string | undefined> => {
  const text = await readFile(file, 'utf8').catch((): undefined => undefined);

  if (text === undefined) return undefined;

  const raw = parseStatus(text);
  const parsed = mergeStatusSchema.safeParse(raw);

  return parsed.data?.status;
};
