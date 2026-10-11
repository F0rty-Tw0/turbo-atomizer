import type { Stats } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';

const ATOMIZER_SRC = join(import.meta.dirname, '..', '..', '..', '..', 'turbo-atomizer', 'src');

/** Set by Nx in every task it runs; `nx e2e` builds the package first (`dependsOn`), so only a direct vitest run needs the check. */
const NX_PROJECT_ENV = 'NX_TASK_TARGET_PROJECT';

const noStats = (): null => null;

/** Mirrors Nx's `production` inputs: specs and `test/` folders never reach `dist`. */
const isBuildInput = (path: string): boolean => {
  const isInTestFolder = path.split(sep).includes('test');

  return !path.endsWith('.spec.ts') && !isInTestFolder;
};

const staleInputs = async (builtMs: number): Promise<string[]> => {
  const paths = await readdir(ATOMIZER_SRC, { recursive: true });
  const stale: string[] = [];

  for (const path of paths.filter(isBuildInput)) {
    const stats = await stat(join(ATOMIZER_SRC, path));
    const isFile = stats.isFile();
    const isStale = isFile && stats.mtimeMs > builtMs;

    if (isStale) stale.push(path);
  }

  return stale;
};

/** Throws when `distDir` is missing or older than a build input under `packages/turbo-atomizer/src`, since `npm pack` would ship that stale build. */
export const assertFreshAtomizerBuild = async (distDir: string): Promise<void> => {
  if (process.env[NX_PROJECT_ENV] !== undefined) return;

  const built: Stats | null = await stat(join(distDir, 'package.json')).catch(noStats);

  if (built === null) throw new Error(`no build at ${distDir}; run the suite with \`nx e2e turbo-atomizer-e2e\`, which builds first`);

  const stale = await staleInputs(built.mtimeMs);

  if (stale.length === 0) return;

  throw new Error(
    `${distDir} is older than ${stale.join(', ')}; run the suite with \`nx e2e turbo-atomizer-e2e\`, which builds first`
  );
};
