import { resolve } from 'node:path';

import { loadAtomizerConfig } from '../../config/domain-logic/atomizer-config.ts';
import { findWorkspaceRoot } from '../../turbo/data-access/workspace-root.store.ts';
import { listWorkspaceDirs } from '../data-access/workspace-dirs.store.ts';
import { readWorkspaceGlobs } from '../data-access/workspace-globs.store.ts';

const hasAtomizerConfig = async (packageDir: string): Promise<boolean> => {
  const loaded = await loadAtomizerConfig(packageDir);

  return loaded.source !== 'default';
};

/** Workspace packages (absolute dirs) that hold an atomizer config, in `turbo-atomizer.json` or `package.json`. */
export const findConfiguredPackages = async (root: string): Promise<string[]> => {
  const globs = await readWorkspaceGlobs(root);
  const dirs = await listWorkspaceDirs(root, globs);
  const configured = await Promise.all(dirs.map(hasAtomizerConfig));

  return dirs.filter((_dir, index): boolean => configured[index] === true);
};

/** Spec §6: `--package` targets that one dir; otherwise every configured package of the workspace around `cwd`. */
export const resolvePackageTargets = async (cwd: string, pkg?: string): Promise<string[]> => {
  if (pkg !== undefined) return [resolve(cwd, pkg)];

  const root = await findWorkspaceRoot(cwd);

  return findConfiguredPackages(root);
};
