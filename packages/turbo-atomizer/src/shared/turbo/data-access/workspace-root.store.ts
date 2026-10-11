import { dirname, resolve } from 'node:path';

import { readTurboJson } from './turbo-json.store.ts';
import { WorkspaceRootMissingException } from '../common/workspace-root-missing.exception.ts';

const findFrom = async (directory: string, fromDir: string): Promise<string> => {
  const turboJson = await readTurboJson(directory);
  const isPackageConfig = turboJson?.content.extends !== undefined;

  if (turboJson !== undefined && !isPackageConfig) return directory;

  const parent = dirname(directory);

  if (parent === directory) throw new WorkspaceRootMissingException(fromDir);

  return findFrom(parent, fromDir);
};

/**
 * Walks up from `fromDir` to the first directory holding `turbo.json` or `turbo.jsonc` without `extends`.
 * Turbo requires `extends` in package configs and forbids it at the root, so a test package's own turbo.json is skipped.
 */
export const findWorkspaceRoot = async (fromDir: string): Promise<string> => {
  const start = resolve(fromDir);

  return findFrom(start, fromDir);
};
