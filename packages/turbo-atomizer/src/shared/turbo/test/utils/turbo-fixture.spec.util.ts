import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FixtureCopy } from '../../../../test/common/fixture-copy.type.ts';

export const turboFixtureDir = (name: string): string => join(import.meta.dirname, '../fixtures', name);

export const copyTurboFixture = async (name: string): Promise<FixtureCopy> => {
  const directory = await mkdtemp(join(tmpdir(), 'atomizer-turbo-'));
  const dispose = async (): Promise<void> => rm(directory, { force: true, recursive: true });

  await cp(turboFixtureDir(name), directory, { recursive: true });

  const copy: FixtureCopy = { directory, dispose };

  return copy;
};
