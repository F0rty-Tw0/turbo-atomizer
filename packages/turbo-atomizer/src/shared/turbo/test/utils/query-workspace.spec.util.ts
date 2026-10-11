import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { copyTurboFixture } from './turbo-fixture.spec.util.ts';
import type { FixtureCopy } from '../../../../test/common/fixture-copy.type.ts';

const installedTurboDir = (): string => {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve('turbo/package.json');

  return dirname(manifestPath);
};

/**
 * Copies the `query-workspace` fixture to a temp dir and adds the `node_modules` git cannot hold:
 * a link to the installed turbo, so the copy runs it like a consumer root does, and a `dep` package the spec imports.
 */
export const copyQueryWorkspace = async (): Promise<FixtureCopy> => {
  const copy = await copyTurboFixture('query-workspace');
  const nodeModules = join(copy.directory, 'node_modules');
  const depDir = join(nodeModules, 'dep');
  const turboDir = installedTurboDir();

  await mkdir(depDir, { recursive: true });
  await symlink(turboDir, join(nodeModules, 'turbo'), 'junction');
  await writeFile(join(depDir, 'package.json'), '{ "name": "dep", "version": "1.0.0", "main": "index.js" }\n');
  await writeFile(join(depDir, 'index.js'), 'exports.dep = 1;\n');

  return copy;
};
