import { join } from 'node:path';

import { build } from 'esbuild';
import type { BuildOptions } from 'esbuild';

import { ENTRY_BUILDS } from './common/build-package.const.ts';
import type { BuildPackageContext, EntryBuild, PackageDependencyMap } from './common/build-package.type.ts';

/** Read by `packages/turbo-atomizer/src/config/build-info.ts`. */
const VERSION_DEFINE = '__TURBO_ATOMIZER_VERSION__';

const externalDependencies = (context: BuildPackageContext): string[] => {
  const dependencies = context.manifest.dependencies ?? {};
  const peerDependencies = context.manifest.peerDependencies ?? {};
  const external: PackageDependencyMap = {
    ...dependencies,
    ...peerDependencies
  };

  return Object.keys(external);
};

const bundleEntries = async (context: BuildPackageContext, entryBuild: EntryBuild): Promise<void> => {
  const sourceRoot = join(context.packageRoot, 'src');
  const entryPoints = entryBuild.entryNames.map((name): string => join(sourceRoot, `${name}.ts`));
  const external = externalDependencies(context);
  const outExtension = { '.js': entryBuild.extension };
  const define = { [VERSION_DEFINE]: JSON.stringify(context.manifest.version) };
  const options: BuildOptions = {
    bundle: true,
    define,
    entryPoints,
    external,
    format: entryBuild.format,
    outdir: context.outputRoot,
    outExtension,
    platform: 'node',
    target: 'node24'
  };

  await build(options);
};

export const bundlePackage = async (context: BuildPackageContext): Promise<void> => {
  for (const entryBuild of ENTRY_BUILDS) {
    await bundleEntries(context, entryBuild);
  }
};
