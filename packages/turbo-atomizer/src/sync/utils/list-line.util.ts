import { posix } from 'node:path';

export const toListLine = (absSpec: string, rootDir: string): string => {
  const posixSpec = absSpec.replaceAll('\\', '/');
  const posixRootDir = rootDir.replaceAll('\\', '/');

  return posix.relative(posixRootDir, posixSpec);
};
