import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { listSpecs } from './playwright-list.process.ts';
import type { FixtureCopy } from '../../../test/common/fixture-copy.type.ts';
import { copyFixture, fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';
import { TURBO_ATOMIZER_SERVER_ENV_ENV } from '../../atomizer/common/atomizer.const.ts';
import { PlaywrightListException } from '../common/playwright-list.exception.ts';
import type { SpecListing } from '../common/spec-listing.type.ts';

const LIST_TIMEOUT_MS = 60_000;
const packageDir = join(fixtureDirectory('basic'), 'apps/e2e');

describe('FEATURE: Playwright list process', (): void => {
  describe('GIVEN the basic fixture wrapped in withAtomizer', (): void => {
    describe('WHEN its specs are listed', (): void => {
      let listing: SpecListing;

      beforeAll(async (): Promise<void> => {
        listing = await listSpecs(packageDir, 'playwright.config.ts');
      }, LIST_TIMEOUT_MS);

      it('THEN the 3 specs and the setup file are returned with their projects', (): void => {
        const setupFile = { absPath: join(packageDir, 'tests/auth.setup.ts'), projects: ['setup'] };
        const specA = { absPath: join(packageDir, 'tests/a.spec.ts'), projects: ['main'] };
        const specB = { absPath: join(packageDir, 'tests/b.spec.ts'), projects: ['main'] };
        const specC = { absPath: join(packageDir, 'tests/nested/c.spec.ts'), projects: ['main'] };

        expect(listing.files).toEqual([setupFile, specA, specB, specC]);
      });

      it('THEN rootDir is the tests directory', (): void => {
        expect(listing.rootDir).toBe(join(packageDir, 'tests'));
      });

      it('THEN the metadata names the setup project', (): void => {
        expect(listing.metadata?.setupProjects).toEqual(['setup']);
      });
    });

    describe('WHEN only metadata is listed', (): void => {
      let listing: SpecListing;
      let tempDir: string;

      beforeAll(async (): Promise<void> => {
        tempDir = await mkdtemp(join(tmpdir(), 'atomizer-list-'));
        vi.stubEnv('TMPDIR', tempDir);
        vi.stubEnv('TMP', tempDir);
        vi.stubEnv('TEMP', tempDir);
        listing = await listSpecs(packageDir, 'playwright.config.ts', { metadataOnly: true });
        vi.unstubAllEnvs();
      }, LIST_TIMEOUT_MS);

      afterAll(async (): Promise<void> => {
        await rm(tempDir, { force: true, recursive: true });
      });

      it('THEN no file is listed', (): void => {
        expect(listing.files).toEqual([]);
      });

      it('THEN metadata and rootDir are present', (): void => {
        expect(listing.metadata?.version).toBe(1);
        expect(listing.rootDir).toBe(join(packageDir, 'tests'));
      });

      it('THEN no temp list file is left behind', async (): Promise<void> => {
        const entries = await readdir(tempDir);
        const leftovers = entries.filter((entry): boolean => entry.startsWith('turbo-atomizer-'));

        expect(leftovers).toEqual([]);
      });
    });

    it(
      'WHEN metadata is listed with TURBO_ATOMIZER_SERVER_ENV in extraEnv THEN serverEnv is recorded',
      async (): Promise<void> => {
        const extraEnv = { [TURBO_ATOMIZER_SERVER_ENV_ENV]: '1' };

        const listing = await listSpecs(packageDir, 'playwright.config.ts', { extraEnv, metadataOnly: true });

        expect(listing.metadata?.serverEnv).toBeDefined();
      },
      LIST_TIMEOUT_MS
    );
  });

  describe('GIVEN the config without the helper', (): void => {
    it(
      'WHEN metadata is listed THEN metadata is undefined',
      async (): Promise<void> => {
        const listing = await listSpecs(packageDir, 'playwright.unwrapped.config.ts', { metadataOnly: true });

        expect(listing.metadata).toBeUndefined();
      },
      LIST_TIMEOUT_MS
    );
  });

  describe('GIVEN a config file that does not exist', (): void => {
    it(
      'WHEN specs are listed THEN it rejects with PlaywrightListException carrying the stderr tail',
      async (): Promise<void> => {
        const listing = listSpecs(packageDir, 'missing.config.ts', { metadataOnly: true });

        await expect(listing).rejects.toBeInstanceOf(PlaywrightListException);
        await expect(listing).rejects.toHaveProperty('stderrTail', expect.stringContaining('missing.config.ts'));
      },
      LIST_TIMEOUT_MS
    );
  });

  describe('GIVEN a copy of the basic fixture under src/test/tmp', (): void => {
    let copy: FixtureCopy;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN metadata is listed THEN the relative helper import still resolves',
      async (): Promise<void> => {
        const copyPackageDir = join(copy.directory, 'apps/e2e');

        const listing = await listSpecs(copyPackageDir, 'playwright.config.ts', { metadataOnly: true });

        expect(listing.metadata?.setupProjects).toEqual(['setup']);
      },
      LIST_TIMEOUT_MS
    );
  });

  describe('GIVEN a copy of the basic fixture without any test file', (): void => {
    let copy: FixtureCopy;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      await rm(join(copy.directory, 'apps/e2e/tests'), { recursive: true });
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN its specs are listed THEN no file is returned and the metadata is present',
      async (): Promise<void> => {
        const copyPackageDir = join(copy.directory, 'apps/e2e');

        const listing = await listSpecs(copyPackageDir, 'playwright.config.ts');

        expect(listing.files).toEqual([]);
        expect(listing.metadata?.version).toBe(1);
      },
      LIST_TIMEOUT_MS
    );
  });
});
