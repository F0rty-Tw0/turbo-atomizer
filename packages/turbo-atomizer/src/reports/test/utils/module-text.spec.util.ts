import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const defaultExportOf = (namespace: unknown): unknown => {
  const isObject = typeof namespace === 'object' && namespace !== null;

  if (!isObject) throw new Error('module namespace is not an object');

  if (!('default' in namespace)) throw new Error('module has no default export');

  return namespace.default;
};

export const importDefaultExport = async (text: string): Promise<unknown> => {
  const directory = await mkdtemp(join(tmpdir(), 'turbo-atomizer-module-'));
  const file = join(directory, 'module.mjs');

  try {
    await writeFile(file, text);

    const url = pathToFileURL(file);
    const namespace: unknown = await import(url.href);

    return defaultExportOf(namespace);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
