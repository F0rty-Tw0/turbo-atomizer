import { describe, expect, it } from 'vitest';

import { lockPathOf, rendezvousPath } from './rendezvous-path.util.ts';

const MACOS_TMP_DIR = '/var/folders/zz/zyxvpxvq6csfxvn_n0000000000000/T/';
const MACOS_SOCKET_PATH_LIMIT = 104;

describe('FEATURE: rendezvous path', () => {
  describe('GIVEN a package dir on Linux', () => {
    it('WHEN the path is built THEN it is a socket named after a 12-char hash in the tmp dir', () => {
      const path = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp');

      expect(path).toMatch(/^\/tmp\/ta-[0-9a-f]{12}\.sock$/);
    });

    it('WHEN the path is built twice THEN both paths are equal', () => {
      const first = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp');
      const second = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp');

      expect(first).toBe(second);
    });
  });

  describe('GIVEN two package dirs', () => {
    it('WHEN both paths are built THEN they differ', () => {
      const web = rendezvousPath('/repo/apps/web-e2e', 'linux', '/tmp');
      const admin = rendezvousPath('/repo/apps/admin-e2e', 'linux', '/tmp');

      expect(web).not.toBe(admin);
    });
  });

  describe('GIVEN a 200-char package dir on macOS', () => {
    it('WHEN the path is built THEN it stays under the 104-byte socket path limit', () => {
      const packageDir = `/Users/dev/${'a'.repeat(189)}`;

      const path = rendezvousPath(packageDir, 'darwin', MACOS_TMP_DIR);

      expect(packageDir).toHaveLength(200);
      expect(Buffer.byteLength(path)).toBeLessThan(MACOS_SOCKET_PATH_LIMIT);
    });
  });

  describe('GIVEN a package dir on Windows', () => {
    it('WHEN the path is built THEN it is a named pipe with the same hash and no tmp dir', () => {
      const socketPath = rendezvousPath('C:\\repo\\apps\\web-e2e', 'linux', '/tmp');
      const hash = socketPath.slice('/tmp/ta-'.length, -'.sock'.length);

      const path = rendezvousPath('C:\\repo\\apps\\web-e2e', 'win32', 'C:\\Temp');

      expect(path).toBe(`\\\\.\\pipe\\turbo-atomizer-${hash}`);
    });
  });

  describe('GIVEN a POSIX socket path', () => {
    it('WHEN its lock path is built THEN the .sock suffix becomes .lock', () => {
      const lockPath = lockPathOf('/tmp/ta-0123456789ab.sock');

      expect(lockPath).toBe('/tmp/ta-0123456789ab.lock');
    });
  });
});
