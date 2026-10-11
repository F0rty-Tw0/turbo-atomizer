import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

const nameField = z.string().optional();

const manifestSchema = z.looseObject({ name: nameField });

/** Returns the `name` in `packageDir/package.json`, or `undefined` when it has none; rejects when the file is missing. */
export const readPackageName = async (packageDir: string): Promise<string | undefined> => {
  const text = await readFile(join(packageDir, 'package.json'), 'utf8');
  const raw: unknown = JSON.parse(text);

  return manifestSchema.parse(raw).name;
};
