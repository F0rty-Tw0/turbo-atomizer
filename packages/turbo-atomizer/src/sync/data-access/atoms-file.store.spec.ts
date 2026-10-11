import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readAtomsFile, writeAtomsFile } from './atoms-file.store.ts';

describe('FEATURE: atoms file store', (): void => {
  let tempDir: string;

  beforeEach(async (): Promise<void> => {
    tempDir = await mkdtemp(join(tmpdir(), 'atomizer-atoms-'));
  });

  afterEach(async (): Promise<void> => {
    await rm(tempDir, { force: true, recursive: true });
  });

  describe('GIVEN no generated turbo.json', (): void => {
    it('WHEN it is read THEN undefined is returned', async (): Promise<void> => {
      const filePath = join(tempDir, 'tools/e2e-atoms/turbo.json');

      const text = await readAtomsFile(filePath);

      expect(text).toBeUndefined();
    });

    it('WHEN it is written THEN its missing directories are created', async (): Promise<void> => {
      const filePath = join(tempDir, 'tools/e2e-atoms/turbo.json');

      await writeAtomsFile(filePath, '{}\n');

      const written = await readFile(filePath, 'utf8');

      expect(written).toBe('{}\n');
    });
  });

  describe('GIVEN a written generated turbo.json', (): void => {
    it('WHEN it is read THEN its text is returned', async (): Promise<void> => {
      const filePath = join(tempDir, 'turbo.json');

      await writeAtomsFile(filePath, '{"tasks":{}}\n');

      const text = await readAtomsFile(filePath);

      expect(text).toBe('{"tasks":{}}\n');
    });
  });
});
