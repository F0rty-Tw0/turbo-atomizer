import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { z } from 'zod';

const binManifestSchema = z.looseObject({
  bin: z.looseObject({ playwright: z.string() })
});

/** Resolves `@playwright/test/package.json` the way the test package's own `require` would. */
export const resolvePlaywrightPackageJson = (packageDir: string): string => {
  const require = createRequire(import.meta.url);
  const paths = [packageDir];

  return require.resolve('@playwright/test/package.json', { paths });
};

export const resolvePlaywrightBin = (packageDir: string): string => {
  const manifestPath = resolvePlaywrightPackageJson(packageDir);
  const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = binManifestSchema.parse(raw);

  return join(dirname(manifestPath), manifest.bin.playwright);
};
