import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { TempConfigPackage } from '../common/atomizer-config.type.ts';

export const configFixtureDir = (name: string): string => join(import.meta.dirname, '../fixtures', name);

export const copyConfigFixture = async (name: string): Promise<TempConfigPackage> => {
  const directory = await mkdtemp(join(tmpdir(), 'atomizer-config-'));
  const dispose = async (): Promise<void> => rm(directory, { force: true, recursive: true });

  await cp(configFixtureDir(name), directory, { recursive: true });

  const tempPackage: TempConfigPackage = { directory, dispose };

  return tempPackage;
};
