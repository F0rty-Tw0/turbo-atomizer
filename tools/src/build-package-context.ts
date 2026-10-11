import { join, resolve } from 'node:path';

import { readJsonFile } from '@nx/devkit';
import type { NxJsonConfiguration } from '@nx/devkit';

import type { BuildPackageContext, PackageManifest } from './common/build-package.type.ts';

const workspaceRoot = resolve(import.meta.dirname, '../..');

const releaseProjectNames = (configuration: NxJsonConfiguration): string[] => {
  const projects = configuration.release?.projects;

  if (!Array.isArray(projects)) throw new Error('Expected nx.json release.projects to list public projects');

  return projects;
};

export const buildPackageContext = (projectRoot: string, outDir: string): BuildPackageContext => {
  const configuration = readJsonFile<NxJsonConfiguration>(join(workspaceRoot, 'nx.json'));
  const projectNames = releaseProjectNames(configuration);
  const packageRoot = resolve(workspaceRoot, projectRoot);
  const manifest = readJsonFile<PackageManifest>(join(packageRoot, 'package.json'));
  const isReleased = projectNames.includes(manifest.name);

  if (manifest.private || !isReleased) throw new Error(`Not a public release project: ${projectRoot}`);

  const context: BuildPackageContext = {
    manifest,
    outputRoot: resolve(workspaceRoot, outDir),
    packageRoot,
    workspaceRoot
  };

  return context;
};
