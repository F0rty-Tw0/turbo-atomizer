import { createHash } from 'node:crypto';
import { posix } from 'node:path';

const shortHash = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 12);

/**
 * `userKey` is the uid on POSIX and the user's random pipe token on Windows, so two users never share a rendezvous.
 * POSIX: `<tmpdir>/turbo-atomizer-<uid>/ta-<hash12>.sock`, inside a dir only that user may write (spec §7 Rendezvous).
 */
export const rendezvousPath = (packageDir: string, platform: NodeJS.Platform, tmpDir: string, userKey: string): string => {
  const hash = shortHash(packageDir);

  if (platform === 'win32') return `\\\\.\\pipe\\turbo-atomizer-${userKey}-${hash}`;

  return posix.join(tmpDir, `turbo-atomizer-${userKey}`, `ta-${hash}.sock`);
};

/** POSIX only: the `O_EXCL` lock guarding a socket, `<tmpdir>/turbo-atomizer-<uid>/ta-<hash12>.lock`. */
export const lockPathOf = (socketPath: string): string => {
  return socketPath.replace(/\.sock$/, '.lock');
};
