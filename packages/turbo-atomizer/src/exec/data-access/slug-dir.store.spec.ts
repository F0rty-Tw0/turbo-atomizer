import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetSlugDir, writeTestList } from './slug-dir.store.ts';
import type { SlugPaths } from '../common/exec.type.ts';

describe('FEATURE: slug dir store', (): void => {
  let packageDir: string;

  beforeEach(async (): Promise<void> => {
    packageDir = await mkdtemp(join(tmpdir(), 'atomizer-slug-'));
  });

  afterEach(async (): Promise<void> => {
    await rm(packageDir, { force: true, recursive: true });
  });

  describe('GIVEN a package without .atomizer/', (): void => {
    it('WHEN the slug dir is reset THEN it exists and is empty', async (): Promise<void> => {
      const paths = await resetSlugDir(packageDir, 'tests-a-spec-ts-abc123');

      const entries = await readdir(paths.dir);

      expect(entries).toEqual([]);
    });

    it('WHEN the slug dir is reset THEN every path sits in .atomizer/<slug>/', async (): Promise<void> => {
      const dir = join(packageDir, '.atomizer', 'slug');
      const expected: SlugPaths = {
        dir,
        testList: join(dir, 'test-list.txt'),
        testResults: join(dir, 'test-results'),
        blob: join(dir, 'blob.zip'),
        html: join(dir, 'html'),
        json: join(dir, 'report.json'),
        junit: join(dir, 'junit.xml'),
        count: join(dir, 'count.json')
      };

      const paths = await resetSlugDir(packageDir, 'slug');

      expect(paths).toEqual(expected);
    });
  });

  describe('GIVEN a slug dir with a stale report', (): void => {
    it('WHEN the slug dir is reset THEN the stale file is gone', async (): Promise<void> => {
      const dir = join(packageDir, '.atomizer', 'slug');
      const staleFile = join(dir, 'html', 'index.html');

      await mkdir(join(dir, 'html'), { recursive: true });
      await writeFile(staleFile, 'stale');
      await resetSlugDir(packageDir, 'slug');

      const isStale = existsSync(staleFile);

      expect(isStale).toBe(false);
    });
  });

  describe('GIVEN a reset slug dir', (): void => {
    it('WHEN the test list is written THEN it holds the list line', async (): Promise<void> => {
      const paths = await resetSlugDir(packageDir, 'slug');

      await writeTestList(paths, 'nested/c.spec.ts');

      const text = await readFile(paths.testList, 'utf8');

      expect(text).toBe('nested/c.spec.ts\n');
    });
  });
});
