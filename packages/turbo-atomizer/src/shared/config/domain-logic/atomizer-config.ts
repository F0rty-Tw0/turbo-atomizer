import { basename, join, resolve } from 'node:path';

import { z } from 'zod';

import { ATOMIZER_CONFIG_FILE, ATOMIZER_PACKAGE_JSON_KEY, DEFAULT_PLAYWRIGHT_CONFIG } from '../../atomizer/common/atomizer.const.ts';
import { atomizerConfigSchema } from '../common/atomizer-config.schema.ts';
import type { AtomizerConfig, AtomizerConfigSource, LoadedAtomizerConfig } from '../common/atomizer-config.type.ts';
import { ConfigConflictException } from '../common/config-conflict.exception.ts';
import { ConfigInvalidException } from '../common/config-invalid.exception.ts';
import { findPlaywrightConfig, readAtomizerConfigFile, readPackageJsonConfig } from '../data-access/atomizer-config.store.ts';

const configLocation = (packageDir: string, source: AtomizerConfigSource): string => {
  if (source === 'package-json') return `${join(packageDir, 'package.json')} "${ATOMIZER_PACKAGE_JSON_KEY}"`;

  return join(packageDir, ATOMIZER_CONFIG_FILE);
};

const resolveConfig = (packageDir: string, raw: unknown, source: AtomizerConfigSource): LoadedAtomizerConfig => {
  const result = atomizerConfigSchema.safeParse(raw);

  if (!result.success) {
    const location = configLocation(packageDir, source);
    const details = z.prettifyError(result.error);

    throw new ConfigInvalidException(location, details, { cause: result.error });
  }

  const packageName = basename(resolve(packageDir));
  const generatedPackage = result.data.generatedPackage ?? `tools/${packageName}-atoms`;
  const playwrightConfig = result.data.playwrightConfig ?? findPlaywrightConfig(packageDir) ?? DEFAULT_PLAYWRIGHT_CONFIG;
  const config: AtomizerConfig = { ...result.data, generatedPackage, playwrightConfig };
  const loaded: LoadedAtomizerConfig = { config, source };

  return loaded;
};

export const loadAtomizerConfig = async (packageDir: string): Promise<LoadedAtomizerConfig> => {
  const fileConfig = await readAtomizerConfigFile(packageDir);
  const packageConfig = await readPackageJsonConfig(packageDir);
  const hasFile = fileConfig !== undefined;
  const hasKey = packageConfig !== undefined;

  if (hasFile && hasKey) throw new ConfigConflictException(packageDir);

  if (hasFile) return resolveConfig(packageDir, fileConfig, 'file');

  if (hasKey) return resolveConfig(packageDir, packageConfig, 'package-json');

  return resolveConfig(packageDir, {}, 'default');
};
