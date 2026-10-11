import { readFileSync } from 'node:fs';

import { z } from 'zod';

import { resolvePlaywrightPackageJson } from './playwright-bin.path.ts';

const versionManifestSchema = z.looseObject({ version: z.string() });

export const getPlaywrightVersion = (packageDir: string): string => {
  const manifestPath = resolvePlaywrightPackageJson(packageDir);
  const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = versionManifestSchema.parse(raw);

  return manifest.version;
};
