import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseDocument } from 'yaml';
import type { Document } from 'yaml';

import { DEPENDENCY_FIELDS, PACKAGE_ASSETS, PACKAGE_BIN, PACKAGE_EXPORTS, PUBLISHED_FILES } from './common/build-package.const.ts';
import type { BuildPackageContext, PackageDependencyMap, PackageManifest } from './common/build-package.type.ts';

const materializedDependencies = (dependencies: PackageDependencyMap, workspace: Document): PackageDependencyMap => {
  const materialized: PackageDependencyMap = {};

  for (const [name, specifier] of Object.entries(dependencies)) {
    const isCatalog = specifier.startsWith('catalog:');

    if (!isCatalog) {
      materialized[name] = specifier;
      continue;
    }

    const catalogName = specifier.slice('catalog:'.length);
    const version: unknown = workspace.getIn(['catalogs', catalogName, name]);

    if (typeof version !== 'string') throw new Error(`Missing catalog value for ${name}: ${specifier}`);

    materialized[name] = version;
  }

  return materialized;
};

const publishedManifest = (manifest: PackageManifest, workspace: Document): PackageManifest => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to drop dev-only fields
  const { devDependencies, nx, scripts, ...source } = manifest;
  const dependencyFields: Record<string, PackageDependencyMap> = {};

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = source[field];

    if (dependencies) {
      dependencyFields[field] = materializedDependencies(dependencies, workspace);
    }
  }

  const published: PackageManifest = {
    ...source,
    ...dependencyFields,
    bin: PACKAGE_BIN,
    exports: PACKAGE_EXPORTS,
    files: PUBLISHED_FILES
  };

  return published;
};

export const writePublishedManifest = async (context: BuildPackageContext): Promise<void> => {
  const source = await readFile(join(context.workspaceRoot, 'pnpm-workspace.yaml'), 'utf8');
  const workspace = parseDocument(source);
  const error = workspace.errors[0];

  if (error) throw error;

  const manifest = publishedManifest(context.manifest, workspace);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;

  await writeFile(join(context.outputRoot, 'package.json'), text);

  for (const asset of PACKAGE_ASSETS) {
    await cp(join(context.workspaceRoot, asset), join(context.outputRoot, asset));
  }
};
