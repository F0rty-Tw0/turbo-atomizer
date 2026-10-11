import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readPackageName } from './package-name.store.ts';
import { fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';

describe('FEATURE: package name store', (): void => {
  describe('GIVEN a package whose package.json has a name', (): void => {
    it('WHEN the name is read THEN it is returned', async (): Promise<void> => {
      const name = await readPackageName(join(fixtureDirectory('basic'), 'apps/e2e'));

      expect(name).toBe('e2e');
    });
  });

  describe('GIVEN a package whose package.json has no name', (): void => {
    let directory: string;

    beforeEach(async (): Promise<void> => {
      directory = await mkdtemp(join(tmpdir(), 'atomizer-name-'));
      await writeFile(join(directory, 'package.json'), '{ "private": true }\n');
    });

    afterEach(async (): Promise<void> => {
      await rm(directory, { force: true, recursive: true });
    });

    it('WHEN the name is read THEN undefined is returned', async (): Promise<void> => {
      const name = await readPackageName(directory);

      expect(name).toBeUndefined();
    });
  });
});
