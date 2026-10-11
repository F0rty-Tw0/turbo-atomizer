import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { collectBlobs, createBlobDir, removeBlobDir } from './blob-collect.store.ts';
import type { BlobCollection } from '../common/reports.type.ts';

const writeBlob = async (packageDir: string, slug: string): Promise<void> => {
  const slugDir = join(packageDir, '.atomizer', slug);

  await mkdir(slugDir, { recursive: true });
  await writeFile(join(slugDir, 'blob.zip'), slug);
};

/** What exec leaves when the server lease fails: it resets `.atomizer/<slug>/` before it starts the server. */
const writeEmptySlugDir = async (packageDir: string, slug: string): Promise<void> => {
  await mkdir(join(packageDir, '.atomizer', slug), { recursive: true });
};

describe('FEATURE: blob collect store', (): void => {
  describe('GIVEN a package with blobs for a current slug and a stale slug, a current slug that never ran, and a current slug that ran without a blob', (): void => {
    let packageDir: string;
    let blobDir: string;
    let collected: BlobCollection;

    beforeAll(async (): Promise<void> => {
      packageDir = await mkdtemp(join(tmpdir(), 'atomizer-blobs-'));
      await writeBlob(packageDir, 'tests-a-spec-ts-111111');
      await writeBlob(packageDir, 'tests-stale-spec-ts-222222');
      await writeEmptySlugDir(packageDir, 'tests-c-spec-ts-444444');
      blobDir = await createBlobDir();
      collected = await collectBlobs(
        packageDir,
        ['tests-a-spec-ts-111111', 'tests-b-spec-ts-333333', 'tests-c-spec-ts-444444'],
        blobDir
      );
    });

    afterAll(async (): Promise<void> => {
      await rm(packageDir, { force: true, recursive: true });
      await removeBlobDir(blobDir);
    });

    it('WHEN the blobs are collected THEN only the current slug with a blob is copied as <slug>.zip', async (): Promise<void> => {
      const files = await readdir(blobDir);

      expect(files).toEqual(['tests-a-spec-ts-111111.zip']);
    });

    it('WHEN the blobs are collected THEN the copy holds the blob bytes', async (): Promise<void> => {
      const text = await readFile(join(blobDir, 'tests-a-spec-ts-111111.zip'), 'utf8');

      expect(text).toBe('tests-a-spec-ts-111111');
    });

    it('WHEN the blobs are collected THEN the number of copied blobs is returned', (): void => {
      expect(collected.copied).toBe(1);
    });

    it('WHEN the blobs are collected THEN only the slug that ran without a blob is reported missing', (): void => {
      expect(collected.missing).toEqual(['tests-c-spec-ts-444444']);
    });
  });

  describe('GIVEN a created blob dir', (): void => {
    it('WHEN it is removed THEN it no longer exists', async (): Promise<void> => {
      const blobDir = await createBlobDir();

      await removeBlobDir(blobDir);

      expect(existsSync(blobDir)).toBe(false);
    });
  });
});
