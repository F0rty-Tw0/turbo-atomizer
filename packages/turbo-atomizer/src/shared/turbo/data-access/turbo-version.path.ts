import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { z } from 'zod';

const versionManifestSchema = z.looseObject({ version: z.string() });

/** Reads `version` from `turbo/package.json` resolved from `workspaceRoot`; spawns nothing. */
export const getTurboVersion = async (workspaceRoot: string): Promise<string> => {
  const require = createRequire(import.meta.url);
  const paths = [workspaceRoot];
  const manifestPath = require.resolve('turbo/package.json', { paths });
  const raw: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  const manifest = versionManifestSchema.parse(raw);

  return manifest.version;
};
