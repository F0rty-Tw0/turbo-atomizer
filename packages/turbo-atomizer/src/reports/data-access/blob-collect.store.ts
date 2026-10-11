import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ATOMIZER_OUTPUT_DIR } from '../../shared/atomizer/common/atomizer.const.ts';
import { BLOB_FILE } from '../common/reports.const.ts';
import type { BlobCollection } from '../common/reports.type.ts';

export const createBlobDir = async (): Promise<string> => mkdtemp(join(tmpdir(), 'turbo-atomizer-blobs-'));

export const removeBlobDir = async (blobDir: string): Promise<void> => rm(blobDir, { force: true, recursive: true });

/**
 * Copies `.atomizer/<slug>/blob.zip` to `<blobDir>/<slug>.zip` for each slug that has one. A slug whose dir exists
 * without a blob is returned as missing; a slug with no dir never ran.
 */
export const collectBlobs = async (packageDir: string, slugs: string[], blobDir: string): Promise<BlobCollection> => {
  let copied = 0;
  const missing: string[] = [];

  for (const slug of slugs) {
    const slugDir = join(packageDir, ATOMIZER_OUTPUT_DIR, slug);
    const source = join(slugDir, BLOB_FILE);
    const hasRun = existsSync(slugDir);
    const hasBlob = existsSync(source);
    const isMissing = hasRun && !hasBlob;

    if (isMissing) missing.push(slug);

    if (!hasBlob) continue;

    await copyFile(source, join(blobDir, `${slug}.zip`));
    copied += 1;
  }

  const collection: BlobCollection = { copied, missing };

  return collection;
};
