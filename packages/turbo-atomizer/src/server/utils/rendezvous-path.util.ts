import { createHash } from 'node:crypto';
import { posix } from 'node:path';

export const rendezvousPath = (packageDir: string, platform: NodeJS.Platform, tmpDir: string): string => {
  const hash = createHash('sha256').update(packageDir).digest('hex').slice(0, 12);

  if (platform === 'win32') return `\\\\.\\pipe\\turbo-atomizer-${hash}`;

  return posix.join(tmpDir, `ta-${hash}.sock`);
};

/** POSIX only: the `O_EXCL` lock guarding a socket, `<tmpdir>/ta-<hash12>.lock`. */
export const lockPathOf = (socketPath: string): string => {
  return socketPath.replace(/\.sock$/, '.lock');
};
