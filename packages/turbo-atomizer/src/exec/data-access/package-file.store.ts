import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const packageFileExists = (packageDir: string, file: string): boolean => {
  return existsSync(resolve(packageDir, file));
};
