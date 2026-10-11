import { dirname, resolve } from 'node:path';

import { findTurboJsonPath } from './turbo-json.store.ts';
import { WorkspaceRootMissingException } from '../common/workspace-root-missing.exception.ts';

const findFrom = async (directory: string, fromDir: string): Promise<string> => {
  const turboJsonPath = await findTurboJsonPath(directory);

  if (turboJsonPath !== undefined) return directory;

  const parent = dirname(directory);

  if (parent === directory) throw new WorkspaceRootMissingException(fromDir);

  return findFrom(parent, fromDir);
};

/** Walks up from `fromDir` to the first directory holding `turbo.json` or `turbo.jsonc`. */
export const findWorkspaceRoot = async (fromDir: string): Promise<string> => {
  const start = resolve(fromDir);

  return findFrom(start, fromDir);
};
