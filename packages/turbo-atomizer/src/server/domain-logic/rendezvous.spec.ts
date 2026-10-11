import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { access, chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claimRendezvous, releaseRendezvous, rendezvousPathOn, rendezvousTokenOn } from './rendezvous.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';
import { RENDEZVOUS_TOKEN_FILE } from '../common/server.const.ts';
import { connectSocket, onVerifiedMessages } from '../data-access/rendezvous-client.socket.ts';
import { acquireLock } from '../data-access/rendezvous.lock.ts';
import { OTHER_TOKEN_STUB, POISONED_READY_LINE_STUB } from '../test/stubs/rendezvous-token.stub.ts';
import { listenAsSupervisor } from '../test/utils/fake-supervisor.spec.util.ts';

const PACKAGE_DIR = 'C:\\repo\\apps\\web-e2e';

const endConnection = (socket: Socket): void => {
  socket.end();
};

const exists = async (path: string): Promise<boolean> => {
  return access(path).then(
    (): boolean => true,
    (): boolean => false
  );
};

describe('FEATURE: rendezvous', (): void => {
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

  describe('GIVEN Windows and no pipe token yet', (): void => {
    it('WHEN the path is built THEN it is a pipe named after the token stored in the tmp dir', async (): Promise<void> => {
      const path = rendezvousPathOn(PACKAGE_DIR, 'win32', directory);

      const token = await readFile(join(directory, RENDEZVOUS_TOKEN_FILE), 'utf8');
      const expected = new RegExp(String.raw`^\\\\\.\\pipe\\turbo-atomizer-${token}-[0-9a-f]{12}$`);

      expect(path).toMatch(expected);
    });

    it('WHEN the path is built twice THEN the token is reused and both paths are equal', (): void => {
      const first = rendezvousPathOn(PACKAGE_DIR, 'win32', directory);
      const second = rendezvousPathOn(PACKAGE_DIR, 'win32', directory);

      expect(first).toBe(second);
    });

    it('WHEN the path is built THEN it holds no hash of the user name', (): void => {
      const userHash = createHash('sha256').update(userInfo().username).digest('hex').slice(0, 12);

      const path = rendezvousPathOn(PACKAGE_DIR, 'win32', directory);

      expect(path).not.toContain(userHash);
    });
  });

  describe('GIVEN Windows and two tmp dirs, each with its own pipe token', (): void => {
    let otherDirectory: string;

    beforeEach(async (): Promise<void> => {
      otherDirectory = await mkdtemp(join(tmpdir(), 'atomizer-claim-'));
    });

    afterEach(async (): Promise<void> => {
      await rm(otherDirectory, { force: true, recursive: true });
    });

    it('WHEN both paths are built THEN the pipe names differ', (): void => {
      const mine = rendezvousPathOn(PACKAGE_DIR, 'win32', directory);
      const theirs = rendezvousPathOn(PACKAGE_DIR, 'win32', otherDirectory);

      expect(mine).not.toBe(theirs);
    });
  });

  describe('GIVEN Windows', (): void => {
    it('WHEN the token is read THEN it is the one stored in the tmp dir that names the pipe', async (): Promise<void> => {
      const path = rendezvousPathOn(PACKAGE_DIR, 'win32', directory);

      const token = rendezvousTokenOn(path, 'win32', directory);

      await expect(readFile(join(directory, RENDEZVOUS_TOKEN_FILE), 'utf8')).resolves.toBe(token);
      expect(path).toContain(token);
    });
  });

  describe('GIVEN POSIX', (): void => {
    it('WHEN the token is read THEN it is stored in the private socket dir, not in the shared tmp dir', async (): Promise<void> => {
      const token = rendezvousTokenOn(socketPath, 'linux', tmpdir());

      await expect(readFile(join(directory, RENDEZVOUS_TOKEN_FILE), 'utf8')).resolves.toBe(token);
      await expect(exists(join(tmpdir(), RENDEZVOUS_TOKEN_FILE))).resolves.toBe(false);
    });
  });

  describe('GIVEN Windows and a squatter that knows the pipe name but not the token', (): void => {
    it('WHEN a client checks it with the token from the tmp dir THEN it is refused before any message', async (): Promise<void> => {
      const token = rendezvousTokenOn(socketPath, 'win32', directory);
      const squatter = await listenAsSupervisor(socketPath, OTHER_TOKEN_STUB, (socket: Socket): void => void socket.end(POISONED_READY_LINE_STUB));
      const client = await connectSocket(socketPath);
      const messages: ServerMessage[] = [];

      const isRefused = await new Promise<boolean>((resolve): void => {
        onVerifiedMessages(client, token, { onMessage: (message): number => messages.push(message), onRefused: (): void => resolve(true) });
      });

      client.destroy();
      squatter.close();
      expect(isRefused).toBe(true);
      expect(messages).toEqual([]);
    });
  });
});
