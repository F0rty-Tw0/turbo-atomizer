import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordSelectedCount } from './count-report.ts';
import { readCountFile } from '../data-access/count-file.store.ts';

describe('FEATURE: count report', (): void => {
  let tempDir: string;

  beforeEach(async (): Promise<void> => {
    tempDir = await mkdtemp(join(tmpdir(), 'atomizer-count-report-'));
  });

  afterEach(async (): Promise<void> => {
    await rm(tempDir, { force: true, recursive: true });
  });

  describe('GIVEN a count file path', (): void => {
    it('WHEN 3 selected tests are recorded THEN the count file reads back 3', async (): Promise<void> => {
      const countFile = join(tempDir, 'count.json');

      await recordSelectedCount(countFile, 3);

      const count = await readCountFile(countFile);

      expect(count).toEqual({ selected: 3 });
    });
  });
});
