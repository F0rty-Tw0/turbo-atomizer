import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readGeneratedPackageOwner, writeGeneratedPackage } from './generated-package.store.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import { InitConflictException } from '../common/init-conflict.exception.ts';

const NAME = '@acme/web-e2e-atoms';

describe('FEATURE: generated package store', (): void => {
  let copy: FixtureCopy;
  let generatedDir: string;

  beforeEach(async (): Promise<void> => {
    copy = await copyFixture('init-pnpm');
    generatedDir = join(copy.directory, 'tools/web-e2e-atoms');
  });

  afterEach(async (): Promise<void> => {
    await copy.dispose();
  });

  describe('GIVEN no generated dir', (): void => {
    it('WHEN the owner is read THEN undefined is returned', async (): Promise<void> => {
      const owner = await readGeneratedPackageOwner(generatedDir);

      expect(owner).toBeUndefined();
    });

    it('WHEN the package is written THEN a change is reported', async (): Promise<void> => {
      const changed = await writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');

      expect(changed).toBe(true);
    });

    it('WHEN the package is written THEN its package.json names it as the owner', async (): Promise<void> => {
      await writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');

      const owner = await readGeneratedPackageOwner(generatedDir);

      expect(owner).toBe(NAME);
    });

    it('WHEN the package is written THEN turbo.json holds the definitions tag and the aggregate task', async (): Promise<void> => {
      const tasks = { 'e2e-ci--all': {} };
      const expected = { extends: ['//'], tags: ['atomizer:definitions'], tasks };

      await writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');

      const text = await readFile(join(generatedDir, 'turbo.json'), 'utf8');
      const turboJson: unknown = JSON.parse(text);

      expect(turboJson).toEqual(expected);
    });

    it('WHEN the package is written twice THEN the second call reports no change', async (): Promise<void> => {
      await writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');

      const changed = await writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');

      expect(changed).toBe(false);
    });
  });

  describe('GIVEN a generated package whose turbo.json sync already rewrote', (): void => {
    const syncedTurboJson =
      '{ "extends": ["//"], "tags": ["atomizer:definitions"], "tasks": { "e2e-ci--all": { "dependsOn": [] } } }\n';

    beforeEach(async (): Promise<void> => {
      await writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');
      await writeFile(join(generatedDir, 'turbo.json'), syncedTurboJson);
    });

    it('WHEN the package is written again THEN turbo.json is left as sync wrote it', async (): Promise<void> => {
      await writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');

      const text = await readFile(join(generatedDir, 'turbo.json'), 'utf8');

      expect(text).toBe(syncedTurboJson);
    });
  });

  describe('GIVEN a generated package that lost its turbo.json', (): void => {
    beforeEach(async (): Promise<void> => {
      await writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');
      await rm(join(generatedDir, 'turbo.json'));
    });

    it('WHEN the package is written THEN turbo.json is recreated and a change is reported', async (): Promise<void> => {
      const changed = await writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');

      expect(changed).toBe(true);
    });
  });

  describe('GIVEN the generated dir holds another package', (): void => {
    it('WHEN the package is written THEN it rejects with InitConflictException', async (): Promise<void> => {
      const foreignDir = join(copy.directory, 'apps/web-e2e');

      const writing = writeGeneratedPackage(foreignDir, NAME, 'e2e-ci');

      await expect(writing).rejects.toBeInstanceOf(InitConflictException);
    });

    it('WHEN the package is written THEN the error names the foreign package', async (): Promise<void> => {
      const foreignDir = join(copy.directory, 'apps/web-e2e');

      const writing = writeGeneratedPackage(foreignDir, NAME, 'e2e-ci');

      await expect(writing).rejects.toThrow('@acme/web-e2e,');
    });
  });

  describe('GIVEN an existing generated dir without package.json', (): void => {
    beforeEach(async (): Promise<void> => {
      await mkdir(generatedDir, { recursive: true });
    });

    it('WHEN the package is written THEN it rejects with InitConflictException', async (): Promise<void> => {
      const writing = writeGeneratedPackage(generatedDir, NAME, 'e2e-ci');

      await expect(writing).rejects.toBeInstanceOf(InitConflictException);
    });
  });
});
