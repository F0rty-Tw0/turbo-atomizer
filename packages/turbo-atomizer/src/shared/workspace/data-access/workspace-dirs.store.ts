import type { Dirent } from 'node:fs';
import { glob } from 'node:fs/promises';
import { join } from 'node:path';

import { toExcludeGlobs, toIncludeGlobs } from '../utils/workspace-glob.util.ts';

const isDirectory = (entry: Dirent): boolean => entry.isDirectory();

const toPath = (entry: Dirent): string => join(entry.parentPath, entry.name);

/** Expands workspace globs (`!` negations excluded) against `root` into absolute, sorted package dirs. */
export const listWorkspaceDirs = async (root: string, globs: string[]): Promise<string[]> => {
  const include = toIncludeGlobs(globs);
  const exclude = toExcludeGlobs(globs);

  if (include.length === 0) return [];

  const dirs: string[] = [];

  for await (const entry of glob(include, { cwd: root, exclude, withFileTypes: true })) {
    const isDir = isDirectory(entry);

    if (isDir) dirs.push(toPath(entry));
  }

  return dirs.toSorted();
};
