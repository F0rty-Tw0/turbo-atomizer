import { basename } from 'node:path';

import { ALL_TASK_SUFFIX, ATOMIZER_DEFINITIONS_TAG } from '../../shared/atomizer/common/atomizer.const.ts';
import type { GeneratedPackage, GeneratedPackageFiles } from '../common/init.type.ts';

const toPosixDir = (dir: string): string => {
  const posix = dir.replaceAll('\\', '/');

  return posix.replace(/\/+$/, '');
};

const jsonText = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Derives the generated package (init step 4): `@acme/web-e2e` in `apps/web-e2e` → `@acme/web-e2e-atoms` in `tools/web-e2e-atoms`. */
export const generatedPackageFor = (testPkgName: string, testPkgDir: string, override?: string): GeneratedPackage => {
  const name = `${testPkgName}-atoms`;
  const defaultDir = `tools/${basename(testPkgDir)}-atoms`;
  const dir = toPosixDir(override ?? defaultDir);
  const generated: GeneratedPackage = { name, dir };

  return generated;
};

/** The generated package's files at creation (init step 5); the turbo.json is already a valid task graph. */
export const generatedPackageFiles = (name: string, task: string): GeneratedPackageFiles => {
  const manifest = { name, private: true, version: '0.0.0' };
  const tasks = { [`${task}${ALL_TASK_SUFFIX}`]: {} };
  const turboJson = { extends: ['//'], tags: [ATOMIZER_DEFINITIONS_TAG], tasks };
  const files: GeneratedPackageFiles = { packageJson: jsonText(manifest), turboJson: jsonText(turboJson) };

  return files;
};
