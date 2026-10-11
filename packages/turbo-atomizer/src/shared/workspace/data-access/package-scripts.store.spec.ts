import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasPackageScript } from './package-scripts.store.ts';

describe('FEATURE: package scripts store', (): void => {
  let directory: string;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'atomizer-scripts-'));
  });

  afterEach(async (): Promise<void> => {
    await rm(directory, { force: true, recursive: true });
  });

  describe('GIVEN a package.json with an e2e-ci script', (): void => {
    beforeEach(async (): Promise<void> => {
      await writeFile(join(directory, 'package.json'), '{ "scripts": { "e2e-ci": "playwright test" } }\n');
    });

    it('WHEN e2e-ci is looked up THEN it is found', async (): Promise<void> => {
      const found = await hasPackageScript(directory, 'e2e-ci');

      expect(found).toBe(true);
    });

    it('WHEN another script is looked up THEN it is not found', async (): Promise<void> => {
      const found = await hasPackageScript(directory, 'build');

      expect(found).toBe(false);
    });
  });

  describe('GIVEN a package.json without scripts', (): void => {
    it('WHEN e2e-ci is looked up THEN it is not found', async (): Promise<void> => {
      await writeFile(join(directory, 'package.json'), '{ "name": "e2e" }\n');

      const found = await hasPackageScript(directory, 'e2e-ci');

      expect(found).toBe(false);
    });
  });
});
