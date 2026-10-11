import { once } from 'node:events';
import { access, chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claimRendezvous, releaseRendezvous } from './rendezvous.ts';
import { acquireLock } from '../data-access/rendezvous.lock.ts';

const endConnection = (socket: Socket): void => {
  socket.end();
};

const exists = async (path: string): Promise<boolean> => {
  return access(path).then(
    (): boolean => true,
    (): boolean => false
  );
};

describe('FEATURE: rendezvous claim', (): void => {
  let directory: string;
  let socketPath: string;
  let lockPath: string;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'atomizer-claim-'));
    socketPath = join(directory, 'ta-test.sock');
    lockPath = join(directory, 'ta-test.lock');
  });

  afterEach(async (): Promise<void> => {
    await rm(directory, { force: true, recursive: true });
  });

  describe('GIVEN a free rendezvous', (): void => {
    it('WHEN it is claimed THEN this process holds the lock and listens', async (): Promise<void> => {
      const server = await claimRendezvous(socketPath, endConnection);
      const lock = await readFile(lockPath, 'utf8');

      expect(server?.listening).toBe(true);
      expect(lock).toContain(`"pid":${String(process.pid)}`);

      if (server !== undefined) await releaseRendezvous(server, socketPath);
    });

    it('WHEN the claim is released THEN the socket and the lock are gone', async (): Promise<void> => {
      const server = await claimRendezvous(socketPath, endConnection);

      if (server !== undefined) await releaseRendezvous(server, socketPath);

      await expect(exists(socketPath)).resolves.toBe(false);
      await expect(exists(lockPath)).resolves.toBe(false);
    });
  });

  describe('GIVEN a rendezvous dir other users can enter', (): void => {
    it('WHEN it is claimed THEN the claim rejects naming the dir and nothing listens', async (): Promise<void> => {
      await chmod(directory, 0o755);

      const claim = claimRendezvous(socketPath, endConnection);

      await expect(claim).rejects.toThrow(`${directory} must be a directory owned by uid`);
      await expect(exists(socketPath)).resolves.toBe(false);
    });
  });

  describe('GIVEN a live listener without a lock', (): void => {
    let live: Server;

    beforeEach(async (): Promise<void> => {
      live = createServer(endConnection);
      live.listen(socketPath);
      await once(live, 'listening');
    });

    afterEach(async (): Promise<void> => {
      live.close();
      await once(live, 'close');
    });

    it('WHEN it is claimed THEN the claim fails, the live socket stays and the lock is released', async (): Promise<void> => {
      const server = await claimRendezvous(socketPath, endConnection);

      expect(server).toBeUndefined();
      await expect(exists(socketPath)).resolves.toBe(true);
      await expect(exists(lockPath)).resolves.toBe(false);
    });
  });

  describe('GIVEN a lock held by a live owner', (): void => {
    it('WHEN it is claimed THEN the claim fails without listening', async (): Promise<void> => {
      await acquireLock(lockPath);

      const server = await claimRendezvous(socketPath, endConnection);

      expect(server).toBeUndefined();
      await expect(exists(socketPath)).resolves.toBe(false);
    });
  });
});
