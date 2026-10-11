import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { bundlePackage } from './build-package-bundle.ts';
import { buildPackageContext } from './build-package-context.ts';
import { emitPackageDeclarations } from './build-package-declarations.ts';
import { writePublishedManifest } from './build-package-manifest.ts';
import { writeConfigSchema } from './build-schema.ts';

export const buildPackage = async (projectRoot: string, outDir: string): Promise<void> => {
  const context = buildPackageContext(projectRoot, outDir);

  await rm(context.outputRoot, { force: true, recursive: true });
  await mkdir(context.outputRoot, { recursive: true });
  await bundlePackage(context);
  emitPackageDeclarations(context);
  await writeConfigSchema(context);
  await writePublishedManifest(context);
};

if (import.meta.main) {
  const projectRoot = process.argv[2];

  if (!projectRoot) throw new Error('Usage: node tools/src/build-package.ts <project-root>');

  await buildPackage(projectRoot, join('dist', projectRoot));
}
