import { once } from 'node:events';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import type { Server } from 'node:net';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensurePrivateDir, readOrCreatePipeToken, refuseForeignSocket } from './rendezvous.path.ts';
import { PIPE_TOKEN_PATTERN } from '../common/server.const.ts';

const PERMISSION_BITS = 0o777;
const PIPE_TOKEN = '0123456789abcdef0123456789abcdef';
const uid = process.getuid?.() ?? 0;
const otherUid = uid + 1;

describe('FEATURE: rendezvous path checks', (): void => {
  let directory: string;
  let privateDir: string;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'atomizer-private-'));
    privateDir = join(directory, 'turbo-atomizer-user');
  });

  afterEach(async (): Promise<void> => {
    await rm(directory, { force: true, recursive: true });
  });

  describe('GIVEN no per-user dir yet', (): void => {
    it('WHEN it is ensured THEN it is created with mode 0700', async (): Promise<void> => {
      await ensurePrivateDir(privateDir, uid);

      const stats = await lstat(privateDir);

      expect(stats.mode & PERMISSION_BITS).toBe(0o700);
    });
  });

  describe('GIVEN a per-user dir with mode 0700', (): void => {
    beforeEach(async (): Promise<void> => {
      await mkdir(privateDir, { mode: 0o700 });
    });

    it('WHEN it is ensured for its owner THEN it is accepted', async (): Promise<void> => {
      const ensured = ensurePrivateDir(privateDir, uid);

      await expect(ensured).resolves.toBeUndefined();
    });

    it('WHEN it is ensured for another uid THEN it is refused', async (): Promise<void> => {
      const ensured = ensurePrivateDir(privateDir, otherUid);

      await expect(ensured).rejects.toThrow(`${privateDir} must be a directory owned by uid ${String(otherUid)} with mode 0700`);
    });
  });

  describe('GIVEN a per-user dir others can read and enter', (): void => {
    it('WHEN it is ensured THEN it is refused', async (): Promise<void> => {
      await mkdir(privateDir);
      await chmod(privateDir, 0o755);

      const ensured = ensurePrivateDir(privateDir, uid);

      await expect(ensured).rejects.toThrow('with mode 0700');
    });
  });

  describe('GIVEN a symlink to a private dir in place of the per-user dir', (): void => {
    it('WHEN it is ensured THEN it is refused', async (): Promise<void> => {
      const target = join(directory, 'target');

      await mkdir(target, { mode: 0o700 });
      await symlink(target, privateDir);

      const ensured = ensurePrivateDir(privateDir, uid);

      await expect(ensured).rejects.toThrow('with mode 0700');
    });
  });

  describe('GIVEN a socket listening in the dir', (): void => {
    let server: Server;
    let socketPath: string;

    beforeEach(async (): Promise<void> => {
      socketPath = join(directory, 'ta-test.sock');
      server = createServer();
      server.listen(socketPath);
      await once(server, 'listening');
    });

    afterEach(async (): Promise<void> => {
      server.close();
      await once(server, 'close');
    });

    it('WHEN its owner checks it THEN it is accepted', async (): Promise<void> => {
      const checked = refuseForeignSocket(socketPath, uid);

      await expect(checked).resolves.toBeUndefined();
    });

    it('WHEN another uid checks it THEN it is refused before any connect', async (): Promise<void> => {
      const checked = refuseForeignSocket(socketPath, otherUid);

      await expect(checked).rejects.toThrow(`${socketPath} is owned by uid ${String(uid)}, not ${String(otherUid)}`);
    });
  });

  describe('GIVEN no socket', (): void => {
    it('WHEN it is checked THEN it is accepted, since nothing listens', async (): Promise<void> => {
      const checked = refuseForeignSocket(join(directory, 'ta-missing.sock'), uid);

      await expect(checked).resolves.toBeUndefined();
    });
  });

  describe('GIVEN no pipe token file', (): void => {
    it('WHEN the token is read THEN a 32-char hex token is written and returned', async (): Promise<void> => {
      const tokenPath = join(directory, 'pipe.token');

      const token = readOrCreatePipeToken(tokenPath);

      expect(token).toMatch(PIPE_TOKEN_PATTERN);
      await expect(readFile(tokenPath, 'utf8')).resolves.toBe(token);
    });

    it('WHEN the token is read THEN no draft file is left behind', async (): Promise<void> => {
      readOrCreatePipeToken(join(directory, 'pipe.token'));

      await expect(readdir(directory)).resolves.toEqual(['pipe.token']);
    });
  });

  describe('GIVEN a pipe token file', (): void => {
    it('WHEN the token is read THEN the stored token is returned', async (): Promise<void> => {
      const tokenPath = join(directory, 'pipe.token');

      await writeFile(tokenPath, PIPE_TOKEN);

      const token = readOrCreatePipeToken(tokenPath);

      expect(token).toBe(PIPE_TOKEN);
    });
  });

  describe('GIVEN a pipe token file that does not hold a token', (): void => {
    it('WHEN the token is read THEN it is refused naming the file', async (): Promise<void> => {
      const tokenPath = join(directory, 'pipe.token');

      await writeFile(tokenPath, '');

      expect((): string => readOrCreatePipeToken(tokenPath)).toThrow(`${tokenPath} does not hold a 32-char hex token`);
    });
  });
});
