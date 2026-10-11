import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

const scriptsField = z.record(z.string(), z.string()).optional();

const manifestSchema = z.looseObject({ scripts: scriptsField });

/** Whether `packageDir/package.json` declares a script named `script` (init step 8); rejects when the file is missing. */
export const hasPackageScript = async (packageDir: string, script: string): Promise<boolean> => {
  const text = await readFile(join(packageDir, 'package.json'), 'utf8');
  const raw: unknown = JSON.parse(text);
  const scripts = manifestSchema.parse(raw).scripts ?? {};

  return Object.hasOwn(scripts, script);
};
