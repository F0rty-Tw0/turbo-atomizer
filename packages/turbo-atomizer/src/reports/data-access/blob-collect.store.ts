import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ATOMIZER_OUTPUT_DIR } from '../../shared/atomizer/common/atomizer.const.ts';
import { BLOB_FILE } from '../common/reports.const.ts';

export const createBlobDir = async (): Promise<string> => mkdtemp(join(tmpdir(), 'turbo-atomizer-blobs-'));

export const removeBlobDir = async (blobDir: string): Promise<void> => rm(blobDir, { force: true, recursive: true });

/** Copies `.atomizer/<slug>/blob.zip` to `<blobDir>/<slug>.zip` for each slug that has one; returns how many were copied. */
export const collectBlobs = async (packageDir: string, slugs: string[], blobDir: string): Promise<number> => {
  let copied = 0;

  for (const slug of slugs) {
    const source = join(packageDir, ATOMIZER_OUTPUT_DIR, slug, BLOB_FILE);
    const exists = existsSync(source);

    if (!exists) continue;

    await copyFile(source, join(blobDir, `${slug}.zip`));
    copied += 1;
  }

  return copied;
};
