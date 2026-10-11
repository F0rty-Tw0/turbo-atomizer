import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readMergeStatus, writeMergeStatus } from './merge-status.store.ts';

describe('FEATURE: merge status store', (): void => {
  let tempDir: string;
  let statusFile: string;

  beforeEach(async (): Promise<void> => {
    tempDir = await mkdtemp(join(tmpdir(), 'atomizer-merge-status-'));
    statusFile = join(tempDir, 'merge-status.json');
  });

  afterEach(async (): Promise<void> => {
    await rm(tempDir, { force: true, recursive: true });
  });

  describe('GIVEN a merged run status', (): void => {
    it('WHEN it is written THEN the file holds {"status":s}', async (): Promise<void> => {
      await writeMergeStatus(statusFile, 'failed');

      const text = await readFile(statusFile, 'utf8');

      expect(text).toBe('{"status":"failed"}');
    });

    it('WHEN it is written and read back THEN the status is returned', async (): Promise<void> => {
      await writeMergeStatus(statusFile, 'passed');

      const status = await readMergeStatus(statusFile);

      expect(status).toBe('passed');
    });
  });

  describe('GIVEN no status file', (): void => {
    it('WHEN it is read THEN undefined is returned', async (): Promise<void> => {
      const status = await readMergeStatus(statusFile);

      expect(status).toBeUndefined();
    });
  });

  describe('GIVEN a status file with another shape', (): void => {
    it('WHEN it is read THEN undefined is returned', async (): Promise<void> => {
      await writeFile(statusFile, '{"status":1}');

      const status = await readMergeStatus(statusFile);

      expect(status).toBeUndefined();
    });
  });

  describe('GIVEN a status file that is not JSON', (): void => {
    it('WHEN it is read THEN undefined is returned', async (): Promise<void> => {
      await writeFile(statusFile, '{"stat');

      const status = await readMergeStatus(statusFile);

      expect(status).toBeUndefined();
    });
  });
});
