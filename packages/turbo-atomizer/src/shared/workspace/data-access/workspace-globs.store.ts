import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, matchesGlob } from 'node:path';

import { Document, isMap, isSeq, parseDocument } from 'yaml';
import { z } from 'zod';

import { appendPackageJsonWorkspace, readPackageJsonWorkspaces } from './root-package-json.store.ts';
import { PNPM_WORKSPACE_FILE } from '../common/workspace.const.ts';
import type { PackageManager } from '../common/workspace.type.ts';

const packagesField = z.array(z.string()).optional();

const pnpmWorkspaceSchema = z.looseObject({ packages: packagesField }).nullable();

const readTextOrEmpty = async (filePath: string): Promise<string> => {
  const exists = existsSync(filePath);

  if (!exists) return '';

  return readFile(filePath, 'utf8');
};

const readPnpmWorkspaceGlobs = async (filePath: string): Promise<string[]> => {
  const text = await readFile(filePath, 'utf8');
  const raw: unknown = parseDocument(text).toJS();
  const workspace = pnpmWorkspaceSchema.parse(raw);

  return workspace?.packages ?? [];
};

/** Returns the workspace globs from `pnpm-workspace.yaml` `packages`, else from the root `package.json` `workspaces`. */
export const readWorkspaceGlobs = async (root: string): Promise<string[]> => {
  const filePath = join(root, PNPM_WORKSPACE_FILE);
  const hasPnpmWorkspace = existsSync(filePath);

  if (hasPnpmWorkspace) return readPnpmWorkspaceGlobs(filePath);

  return readPackageJsonWorkspaces(root);
};

const normalizeGlob = (glob: string): string => {
  const withoutDotSlash = glob.replace(/^\.\//, '');

  return withoutDotSlash.replace(/\/+$/, '');
};

const coversDir = (glob: string, dir: string): boolean => {
  const isNegation = glob.startsWith('!');

  if (isNegation) return false;

  return matchesGlob(dir, normalizeGlob(glob));
};

const withWorkspaceGlob = (text: string, dir: string): string => {
  const document = parseDocument(text);
  const packages = document.get('packages');

  if (isSeq(packages)) {
    document.addIn(['packages'], dir);

    return document.toString();
  }

  const packagesNode = document.createNode([dir]);

  if (isMap(document.contents)) {
    document.set('packages', packagesNode);

    return document.toString();
  }

  const workspace = new Document({ packages: [dir] });

  return workspace.toString();
};

const addPnpmWorkspaceGlob = async (root: string, dir: string): Promise<void> => {
  const filePath = join(root, PNPM_WORKSPACE_FILE);
  const text = await readTextOrEmpty(filePath);

  await writeFile(filePath, withWorkspaceGlob(text, dir));
};

/** Adds `dir` (posix, relative to the root) to the workspace globs unless a glob already covers it (init step 6). */
export const ensureWorkspaceGlob = async (root: string, pm: PackageManager, dir: string): Promise<boolean> => {
  const globs = await readWorkspaceGlobs(root);
  const isCovered = globs.some((glob) => coversDir(glob, dir));

  if (isCovered) return false;

  if (pm === 'pnpm') {
    await addPnpmWorkspaceGlob(root, dir);
  } else {
    await appendPackageJsonWorkspace(root, dir);
  }

  return true;
};
