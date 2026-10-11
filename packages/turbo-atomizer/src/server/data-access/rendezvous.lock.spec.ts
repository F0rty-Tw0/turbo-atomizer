import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { acquireLock, releaseLock } from './rendezvous.lock.ts';
import { exitedPid } from '../test/utils/static-server.spec.util.ts';

const readOwner = async (lockPath: string): Promise<unknown> => {
  const text = await readFile(lockPath, 'utf8');
  const owner: unknown = JSON.parse(text);

  return owner;
};

describe('FEATURE: rendezvous lock', (): void => {
  let directory: string;
  let lockPath: string;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'atomizer-lock-'));
    lockPath = join(directory, 'ta-test.lock');
  });

  afterEach(async (): Promise<void> => {
    await rm(directory, { force: true, recursive: true });
  });

  describe('GIVEN no lock file', (): void => {
    it('WHEN the lock is acquired THEN it succeeds and records this pid', async (): Promise<void> => {
      const isAcquired = await acquireLock(lockPath);

      expect(isAcquired).toBe(true);
      await expect(readOwner(lockPath)).resolves.toMatchObject({ pid: process.pid });
    });
  });

  describe('GIVEN a lock held by a live owner', (): void => {
    it('WHEN the lock is acquired again THEN it fails', async (): Promise<void> => {
      await acquireLock(lockPath);

      const isAcquired = await acquireLock(lockPath);

      expect(isAcquired).toBe(false);
    });
  });

  describe('GIVEN a lock whose owner pid is dead', (): void => {
    it('WHEN the lock is acquired THEN it is taken over and no stale file remains', async (): Promise<void> => {
      const deadPid = await exitedPid();

      await writeFile(lockPath, JSON.stringify({ pid: deadPid, startTime: 'gone' }));

      const isAcquired = await acquireLock(lockPath);
      const files = await readdir(directory);

      expect(isAcquired).toBe(true);
      expect(files).toEqual(['ta-test.lock']);
      await expect(readOwner(lockPath)).resolves.toMatchObject({ pid: process.pid });
    });
  });

  describe('GIVEN a lock whose live pid has a different start time', (): void => {
    it('WHEN the lock is acquired THEN the reused pid is treated as gone', async (): Promise<void> => {
      await writeFile(lockPath, JSON.stringify({ pid: process.pid, startTime: 'Thu Jan  1 00:00:00 1970' }));

      const isAcquired = await acquireLock(lockPath);

      expect(isAcquired).toBe(true);
    });
  });

  describe('GIVEN an unreadable lock file', (): void => {
    it('WHEN the lock is acquired THEN it is taken over', async (): Promise<void> => {
      await writeFile(lockPath, 'not json');

      const isAcquired = await acquireLock(lockPath);

      expect(isAcquired).toBe(true);
    });
  });

  describe('GIVEN a lock this process owns', (): void => {
    it('WHEN it is released THEN the file is removed', async (): Promise<void> => {
      await acquireLock(lockPath);

      await releaseLock(lockPath);

      await expect(readdir(directory)).resolves.toEqual([]);
    });
  });

  describe('GIVEN a lock another process owns', (): void => {
    it('WHEN it is released THEN the file is kept', async (): Promise<void> => {
      await writeFile(lockPath, JSON.stringify({ pid: 1, startTime: 'init' }));

      await releaseLock(lockPath);

      await expect(readdir(directory)).resolves.toEqual(['ta-test.lock']);
    });
  });
});
