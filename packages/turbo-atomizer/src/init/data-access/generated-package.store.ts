import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import { InitConflictException } from '../common/init-conflict.exception.ts';
import { generatedPackageFiles } from '../utils/generated-package.util.ts';

const nameField = z.string().optional();

const manifestSchema = z.looseObject({ name: nameField });

const writeIfAbsent = async (filePath: string, text: string): Promise<boolean> => {
  const exists = existsSync(filePath);

  if (exists) return false;

  await writeFile(filePath, text, { flag: 'wx' });

  return true;
};

const parseManifest = (filePath: string, text: string): unknown => {
  try {
    const raw: unknown = JSON.parse(text);

    return raw;
  } catch (error) {
    throw new InitConflictException(filePath, `is not valid JSON (${String(error)}); fix it or pass --generated-dir to choose another dir.`);
  }
};

/**
 * Returns the `name` in `dir/package.json`, or `undefined` when there is none. The generated package is owned
 * by the test package whose name plus `-atoms` it carries, so this name is the ownership record (init step 4).
 */
export const readGeneratedPackageOwner = async (dir: string): Promise<string | undefined> => {
  const filePath = join(dir, 'package.json');
  const exists = existsSync(filePath);

  if (!exists) return undefined;

  const text = await readFile(filePath, 'utf8');
  const raw = parseManifest(filePath, text);

  return manifestSchema.parse(raw).name;
};

/**
 * Creates the generated package's missing files (init step 5). Throws `InitConflictException` when `dir`
 * exists and is not the package named `name`. An existing turbo.json is never rewritten; sync owns it.
 */
export const writeGeneratedPackage = async (dir: string, name: string, task: string): Promise<boolean> => {
  const dirExists = existsSync(dir);

  if (dirExists) {
    const owner = await readGeneratedPackageOwner(dir);
    const found = owner ?? 'no package.json';

    if (owner !== name) {
      throw new InitConflictException(
        dir,
        `holds ${found}, not the generated package ${name}; pass --generated-dir to choose another dir.`
      );
    }
  }

  const files = generatedPackageFiles(name, task);

  await mkdir(dir, { recursive: true });

  const wrotePackageJson = await writeIfAbsent(join(dir, 'package.json'), files.packageJson);
  const wroteTurboJson = await writeIfAbsent(join(dir, 'turbo.json'), files.turboJson);

  return wrotePackageJson || wroteTurboJson;
};
