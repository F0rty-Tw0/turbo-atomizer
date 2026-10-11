import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readCountFile, writeCountFile } from './count-file.store.ts';

describe('FEATURE: count file store', (): void => {
  let tempDir: string;
  let countFile: string;

  beforeEach(async (): Promise<void> => {
    tempDir = await mkdtemp(join(tmpdir(), 'atomizer-count-'));
    countFile = join(tempDir, 'count.json');
  });

  afterEach(async (): Promise<void> => {
    await rm(tempDir, { force: true, recursive: true });
  });

  describe('GIVEN a selected count', (): void => {
    it('WHEN it is written THEN the file holds {"selected":n}', async (): Promise<void> => {
      await writeCountFile(countFile, 2);

      const text = await readFile(countFile, 'utf8');

      expect(text).toBe('{"selected":2}');
    });

    it('WHEN it is written and read back THEN the count is returned', async (): Promise<void> => {
      await writeCountFile(countFile, 0);

      const count = await readCountFile(countFile);

      expect(count).toEqual({ selected: 0 });
    });
  });

  describe('GIVEN no count file', (): void => {
    it('WHEN it is read THEN undefined is returned', async (): Promise<void> => {
      const count = await readCountFile(countFile);

      expect(count).toBeUndefined();
    });
  });

  describe('GIVEN a count file with another shape', (): void => {
    it('WHEN it is read THEN undefined is returned', async (): Promise<void> => {
      await writeFile(countFile, '{"selected":"two"}');

      const count = await readCountFile(countFile);

      expect(count).toBeUndefined();
    });
  });

  describe('GIVEN a count file that is not JSON', (): void => {
    it('WHEN it is read THEN undefined is returned', async (): Promise<void> => {
      await writeFile(countFile, '{"selec');

      const count = await readCountFile(countFile);

      expect(count).toBeUndefined();
    });
  });
});
