import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { FixtureCopy } from '../common/fixture-copy.type.ts';

export const fixtureDirectory = (name: string): string => join(import.meta.dirname, '../fixtures', name);

/** Copies a shared fixture to `src/test/tmp/<random>/`, the same depth as `src/test/fixtures/<name>/`, so relative imports still resolve. */
export const copyFixture = async (name: string): Promise<FixtureCopy> => {
  const tmpRoot = join(import.meta.dirname, '../tmp');

  await mkdir(tmpRoot, { recursive: true });

  const directory = await mkdtemp(join(tmpRoot, `${name}-`));
  const dispose = async (): Promise<void> => rm(directory, { force: true, recursive: true });

  await cp(fixtureDirectory(name), directory, { recursive: true });

  const copy: FixtureCopy = { directory, dispose };

  return copy;
};
