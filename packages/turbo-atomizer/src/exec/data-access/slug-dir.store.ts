import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ATOMIZER_OUTPUT_DIR } from '../../shared/atomizer/common/atomizer.const.ts';
import type { SlugPaths } from '../common/exec.type.ts';

/** Deletes and recreates `.atomizer/<slug>/`, so no stale report survives, and returns its paths. */
export const resetSlugDir = async (packageDir: string, slug: string): Promise<SlugPaths> => {
  const dir = join(packageDir, ATOMIZER_OUTPUT_DIR, slug);
  const paths: SlugPaths = {
    dir,
    testList: join(dir, 'test-list.txt'),
    testResults: join(dir, 'test-results'),
    blob: join(dir, 'blob.zip'),
    html: join(dir, 'html'),
    json: join(dir, 'report.json'),
    junit: join(dir, 'junit.xml'),
    count: join(dir, 'count.json')
  };

  await rm(dir, { force: true, recursive: true });
  await mkdir(dir, { recursive: true });

  return paths;
};

export const writeTestList = async (paths: SlugPaths, listLine: string): Promise<void> => {
  await writeFile(paths.testList, `${listLine}\n`);
};
