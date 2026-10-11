import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { CONFIG_SCHEMA_MODULE } from './common/build-package.const.ts';
import type { BuildPackageContext } from './common/build-package.type.ts';

type JsonSchemaParams = {
  readonly io: 'input';
};

type JsonSchemaSource = {
  readonly toJSONSchema: (params: JsonSchemaParams) => unknown;
};

type ConfigSchemaModule = {
  readonly atomizerConfigSchema: JsonSchemaSource;
};

const isConfigSchemaModule = (value: unknown): value is ConfigSchemaModule => {
  if (typeof value !== 'object' || value === null) return false;

  if (!('atomizerConfigSchema' in value)) return false;

  const schema = value.atomizerConfigSchema;

  if (typeof schema !== 'object' || schema === null) return false;

  return 'toJSONSchema' in schema && typeof schema.toJSONSchema === 'function';
};

export const writeConfigSchema = async (context: BuildPackageContext): Promise<void> => {
  const modulePath = join(context.packageRoot, CONFIG_SCHEMA_MODULE);
  const moduleUrl = pathToFileURL(modulePath).href;
  const schemaModule: unknown = await import(moduleUrl);

  if (!isConfigSchemaModule(schemaModule)) throw new Error(`Expected atomizerConfigSchema in ${modulePath}`);

  const schema = schemaModule.atomizerConfigSchema.toJSONSchema({ io: 'input' });
  const text = `${JSON.stringify(schema, null, 2)}\n`;

  await writeFile(join(context.outputRoot, 'schema.json'), text);
};
