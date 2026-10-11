import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import {
  ATOMIZER_CONFIG_FILE,
  ATOMIZER_PACKAGE_JSON_KEY,
  PLAYWRIGHT_CONFIG_FILES
} from '../../atomizer/common/atomizer.const.ts';
import type { AtomizerConfig } from '../common/atomizer-config.type.ts';
import { ConfigInvalidException } from '../common/config-invalid.exception.ts';

const packageConfigField = z.unknown().optional();

const packageJsonSchema = z.looseObject({
  [ATOMIZER_PACKAGE_JSON_KEY]: packageConfigField
});

/** Returns the parsed `turbo-atomizer.json`, or `undefined` when the file is absent. */
export const readAtomizerConfigFile = async (packageDir: string): Promise<unknown> => {
  const filePath = join(packageDir, ATOMIZER_CONFIG_FILE);
  const exists = existsSync(filePath);

  if (!exists) return undefined;

  const text = await readFile(filePath, 'utf8');

  try {
    const raw: unknown = JSON.parse(text);

    return raw;
  } catch (error) {
    const details = String(error);

    throw new ConfigInvalidException(filePath, details, { cause: error });
  }
};

/** Returns the `"turbo-atomizer"` key of `package.json`, or `undefined` when the key or the file is absent. */
export const readPackageJsonConfig = async (packageDir: string): Promise<unknown> => {
  const filePath = join(packageDir, 'package.json');
  const exists = existsSync(filePath);

  if (!exists) return undefined;

  const text = await readFile(filePath, 'utf8');
  const raw: unknown = JSON.parse(text);
  const manifest = packageJsonSchema.parse(raw);

  return manifest[ATOMIZER_PACKAGE_JSON_KEY];
};

export const findPlaywrightConfig = (packageDir: string): string | undefined => {
  return PLAYWRIGHT_CONFIG_FILES.find((name) => existsSync(join(packageDir, name)));
};

export const writeAtomizerConfigFile = async (
  packageDir: string,
  partial: Partial<AtomizerConfig>
): Promise<boolean> => {
  const fileConfig = await readAtomizerConfigFile(packageDir);
  const packageConfig = await readPackageJsonConfig(packageDir);
  const hasConfig = fileConfig !== undefined || packageConfig !== undefined;

  if (hasConfig) return false;

  const text = `${JSON.stringify(partial, null, 2)}\n`;

  await writeFile(join(packageDir, ATOMIZER_CONFIG_FILE), text, { flag: 'wx' });

  return true;
};
