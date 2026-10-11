import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  findPlaywrightConfig,
  readAtomizerConfigFile,
  readPackageJsonConfig,
  writeAtomizerConfigFile
} from './atomizer-config.store.ts';
import { ConfigInvalidException } from '../common/config-invalid.exception.ts';
import type { TempConfigPackage } from '../test/common/atomizer-config.type.ts';
import { configFixtureDir, copyConfigFixture } from '../test/utils/config-fixture.spec.util.ts';

describe('FEATURE: atomizer config store', (): void => {
  describe('GIVEN a package with turbo-atomizer.json', (): void => {
    it('WHEN the file is read THEN its parsed JSON is returned', async (): Promise<void> => {
      const raw = await readAtomizerConfigFile(configFixtureDir('file-config'));

      expect(raw).toMatchObject({ task: 'e2e' });
    });

    it('WHEN the Playwright config is looked up THEN the first existing candidate is returned', (): void => {
      const playwrightConfig = findPlaywrightConfig(configFixtureDir('file-config'));

      expect(playwrightConfig).toBe('playwright.config.mjs');
    });
  });

  describe('GIVEN a turbo-atomizer.json that is not valid JSON', (): void => {
    it('WHEN the file is read THEN it rejects with ConfigInvalidException', async (): Promise<void> => {
      const reading = readAtomizerConfigFile(configFixtureDir('broken-json'));

      await expect(reading).rejects.toBeInstanceOf(ConfigInvalidException);
    });
  });

  describe('GIVEN a package with a "turbo-atomizer" key in package.json', (): void => {
    it('WHEN the key is read THEN its value is returned', async (): Promise<void> => {
      const raw = await readPackageJsonConfig(configFixtureDir('package-json-config'));

      expect(raw).toMatchObject({ task: 'smoke' });
    });
  });

  describe('GIVEN a package with neither config nor Playwright config', (): void => {
    it('WHEN the file is read THEN undefined is returned', async (): Promise<void> => {
      const raw = await readAtomizerConfigFile(configFixtureDir('no-config'));

      expect(raw).toBeUndefined();
    });

    it('WHEN the package.json key is read THEN undefined is returned', async (): Promise<void> => {
      const raw = await readPackageJsonConfig(configFixtureDir('no-config'));

      expect(raw).toBeUndefined();
    });

    it('WHEN the Playwright config is looked up THEN undefined is returned', (): void => {
      const playwrightConfig = findPlaywrightConfig(configFixtureDir('no-config'));

      expect(playwrightConfig).toBeUndefined();
    });
  });

  describe('GIVEN a package without package.json', (): void => {
    it('WHEN the package.json key is read THEN undefined is returned', async (): Promise<void> => {
      const raw = await readPackageJsonConfig(configFixtureDir('invalid-config'));

      expect(raw).toBeUndefined();
    });
  });

  describe('GIVEN a copied package with no config', (): void => {
    let tempPackage: TempConfigPackage | undefined;

    afterEach(async (): Promise<void> => {
      await tempPackage?.dispose();
    });

    describe('WHEN the config file is written', (): void => {
      it('THEN true is returned', async (): Promise<void> => {
        tempPackage = await copyConfigFixture('no-config');

        const written = await writeAtomizerConfigFile(tempPackage.directory, { task: 'e2e' });

        expect(written).toBe(true);
      });

      it('THEN turbo-atomizer.json holds the partial config', async (): Promise<void> => {
        tempPackage = await copyConfigFixture('no-config');
        const filePath = join(tempPackage.directory, 'turbo-atomizer.json');

        await writeAtomizerConfigFile(tempPackage.directory, { task: 'e2e' });

        const text = await readFile(filePath, 'utf8');

        expect(text).toBe('{\n  "task": "e2e"\n}\n');
      });
    });

    it('WHEN the config file is written twice THEN the second call returns false', async (): Promise<void> => {
      tempPackage = await copyConfigFixture('no-config');
      await writeAtomizerConfigFile(tempPackage.directory, { task: 'e2e' });

      const written = await writeAtomizerConfigFile(tempPackage.directory, { task: 'other' });

      expect(written).toBe(false);
    });
  });

  describe('GIVEN a copied package with a "turbo-atomizer" key in package.json', (): void => {
    let tempPackage: TempConfigPackage | undefined;

    afterEach(async (): Promise<void> => {
      await tempPackage?.dispose();
    });

    it('WHEN the config file is written THEN false is returned', async (): Promise<void> => {
      tempPackage = await copyConfigFixture('package-json-config');

      const written = await writeAtomizerConfigFile(tempPackage.directory, { task: 'e2e' });

      expect(written).toBe(false);
    });

    it('WHEN the config file is written THEN no turbo-atomizer.json is created', async (): Promise<void> => {
      tempPackage = await copyConfigFixture('package-json-config');
      const filePath = join(tempPackage.directory, 'turbo-atomizer.json');

      await writeAtomizerConfigFile(tempPackage.directory, { task: 'e2e' });

      const exists = existsSync(filePath);

      expect(exists).toBe(false);
    });
  });
});
