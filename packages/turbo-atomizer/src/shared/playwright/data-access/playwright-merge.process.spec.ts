import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runPlaywrightMerge } from './playwright-merge.process.ts';
import { fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';

const MERGE_TIMEOUT_MS = 60_000;
const packageDir = join(fixtureDirectory('basic'), 'apps/e2e');

describe('FEATURE: Playwright merge process', (): void => {
  describe('GIVEN an empty blob dir and a plain merge config', (): void => {
    let tempDir: string;
    let blobDir: string;
    let configPath: string;

    beforeAll(async (): Promise<void> => {
      tempDir = await mkdtemp(join(tmpdir(), 'atomizer-merge-'));
      blobDir = join(tempDir, 'blobs');
      configPath = join(tempDir, 'merge.config.mjs');
      await mkdir(blobDir);
      await writeFile(configPath, 'export default { reporter: [] };\n');
    });

    afterAll(async (): Promise<void> => {
      await rm(tempDir, { force: true, recursive: true });
    });

    it(
      'WHEN merge-reports runs THEN Playwright exits non-zero',
      async (): Promise<void> => {
        const exitCode = await runPlaywrightMerge(packageDir, blobDir, configPath);

        expect(exitCode).not.toBe(0);
      },
      MERGE_TIMEOUT_MS
    );
  });
});
