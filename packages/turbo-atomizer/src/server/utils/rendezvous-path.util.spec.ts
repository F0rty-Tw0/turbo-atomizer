import { describe, expect, it } from 'vitest';

import { lockPathOf, rendezvousPath } from './rendezvous-path.util.ts';

const MACOS_TMP_DIR = '/var/folders/zz/zyxvpxvq6csfxvn_n0000000000000/T/';
const MACOS_SOCKET_PATH_LIMIT = 104;
const MAX_UID = '4294967294';

describe('FEATURE: rendezvous path', () => {
  describe('GIVEN a package dir on Linux', () => {
    it('WHEN the path is built THEN it is a socket named after a 12-char hash in the per-user dir of the tmp dir', () => {
      const path = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp', '1000');

      expect(path).toMatch(/^\/tmp\/turbo-atomizer-1000\/ta-[0-9a-f]{12}\.sock$/);
    });

    it('WHEN the path is built twice THEN both paths are equal', () => {
      const first = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp', '1000');
      const second = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp', '1000');

      expect(first).toBe(second);
    });

    it('WHEN two users build it THEN the paths differ', () => {
      const mine = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp', '1000');
      const theirs = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp', '1001');

      expect(mine).not.toBe(theirs);
    });
  });

  describe('GIVEN two package dirs', () => {
    it('WHEN both paths are built THEN they differ', () => {
      const web = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp', '1000');
      const admin = rendezvousPath('/repo/apps/admin-e2e', 'linux', '/tmp', '1000');

      expect(web).not.toBe(admin);
    });
  });

  describe('GIVEN a 200-char package dir and the largest uid on macOS', () => {
    it('WHEN the path is built THEN it stays under the 104-byte socket path limit', () => {
      const packageDir = `/Users/dev/${'a'.repeat(189)}`;

      const path = rendezvousPath(packageDir, 'darwin', MACOS_TMP_DIR, MAX_UID);

      expect(packageDir).toHaveLength(200);
      expect(Buffer.byteLength(path)).toBeLessThan(MACOS_SOCKET_PATH_LIMIT);
    });
  });

  describe('GIVEN a package dir on Windows', () => {
    it('WHEN the path is built THEN it is a named pipe with a user hash, the package hash and no tmp dir', () => {
      const socketPath = rendezvousPath('C:\\repo\\apps\\web-e2e', 'linux', '/tmp', '1000');
      const hash = socketPath.slice(-'0123456789ab.sock'.length, -'.sock'.length);
      const expected = new RegExp(String.raw`^\\\\\.\\pipe\\turbo-atomizer-[0-9a-f]{12}-${hash}$`);

      const path = rendezvousPath('C:\\repo\\apps\\web-e2e', 'win32', 'C:\\Temp', 'dev');

      expect(path).toMatch(expected);
    });

    it('WHEN two users build it THEN the pipe names differ', () => {
      const mine = rendezvousPath('C:\\repo\\apps\\web-e2e', 'win32', 'C:\\Temp', 'dev');
      const theirs = rendezvousPath('C:\\repo\\apps\\web-e2e', 'win32', 'C:\\Temp', 'other');

      expect(mine).not.toBe(theirs);
    });
  });

  describe('GIVEN a POSIX socket path', () => {
    it('WHEN its lock path is built THEN the .sock suffix becomes .lock', () => {
      const lockPath = lockPathOf('/tmp/turbo-atomizer-1000/ta-0123456789ab.sock');

      expect(lockPath).toBe('/tmp/turbo-atomizer-1000/ta-0123456789ab.lock');
    });
  });
});
