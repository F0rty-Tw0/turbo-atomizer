import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { z } from 'zod';

const binManifestSchema = z.looseObject({
  bin: z.looseObject({ turbo: z.string() })
});

/** `bin.turbo` of `turbo/package.json` resolved from the workspace root, as an absolute path. */
export const resolveTurboBin = (root: string): string => {
  const require = createRequire(import.meta.url);
  const paths = [root];
  const manifestPath = require.resolve('turbo/package.json', { paths });
  const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = binManifestSchema.parse(raw);

  return join(dirname(manifestPath), manifest.bin.turbo);
};
