import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { applyEdits, modify } from 'jsonc-parser';
import type { JSONPath } from 'jsonc-parser';
import { z } from 'zod';

type WorkspacesObject = {
  readonly packages: string[];
};

type RootPackageJson = {
  readonly dependencies?: Record<string, string> | undefined;
  readonly devDependencies?: Record<string, string> | undefined;
  readonly workspaces?: string[] | WorkspacesObject | undefined;
};

const dependencyMap = z.record(z.string(), z.string()).optional();

const workspacesField = z.union([z.array(z.string()), z.looseObject({ packages: z.array(z.string()) })]).optional();

const rootPackageJsonSchema: z.ZodType<RootPackageJson> = z.looseObject({
  dependencies: dependencyMap,
  devDependencies: dependencyMap,
  workspaces: workspacesField
});

const WORKSPACES_ARRAY_PATH: JSONPath = ['workspaces', -1];

const WORKSPACES_PACKAGES_PATH: JSONPath = ['workspaces', 'packages', -1];

const formattingOptions = { insertSpaces: true, tabSize: 2 };

const packageJsonPath = (root: string): string => join(root, 'package.json');

const readRootPackageJson = async (root: string): Promise<RootPackageJson> => {
  const text = await readFile(packageJsonPath(root), 'utf8');
  const raw: unknown = JSON.parse(text);

  return rootPackageJsonSchema.parse(raw);
};

/** Returns the root `package.json` `workspaces` globs, from either the array or the `{ packages }` form. */
export const readPackageJsonWorkspaces = async (root: string): Promise<string[]> => {
  const manifest = await readRootPackageJson(root);
  const workspaces = manifest.workspaces ?? [];

  if (Array.isArray(workspaces)) return workspaces;

  return workspaces.packages;
};

const editRootPackageJson = async (root: string, path: JSONPath, value: unknown, isArrayInsertion: boolean): Promise<void> => {
  const filePath = packageJsonPath(root);
  const text = await readFile(filePath, 'utf8');
  const edits = modify(text, path, value, { formattingOptions, isArrayInsertion });

  await writeFile(filePath, applyEdits(text, edits));
};

/** Appends `dir` to the root `package.json` `workspaces`, in whichever form the file uses. */
export const appendPackageJsonWorkspace = async (root: string, dir: string): Promise<void> => {
  const manifest = await readRootPackageJson(root);
  const { workspaces } = manifest;

  if (workspaces === undefined) return editRootPackageJson(root, ['workspaces'], [dir], false);

  const isArrayForm = Array.isArray(workspaces);
  const path = isArrayForm ? WORKSPACES_ARRAY_PATH : WORKSPACES_PACKAGES_PATH;

  await editRootPackageJson(root, path, dir, true);
};

/** Adds `name` to the root devDependencies unless the root already lists it under any spec (init step 9). */
export const ensureRootDevDependency = async (root: string, name: string, spec: string): Promise<boolean> => {
  const manifest = await readRootPackageJson(root);
  const isListed = manifest.dependencies?.[name] !== undefined || manifest.devDependencies?.[name] !== undefined;

  if (isListed) return false;

  await editRootPackageJson(root, ['devDependencies', name], spec, false);

  return true;
};
