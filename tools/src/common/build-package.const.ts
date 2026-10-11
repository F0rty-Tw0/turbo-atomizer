import type { DependencyField, EntryBuild, PackageBinMap, PackageExportConditions, PackageExportMap } from './build-package.type.ts';

const esmBuild: EntryBuild = {
  entryNames: ['cli', 'index', 'playwright', 'supervisor'],
  extension: '.js',
  format: 'esm'
};

const cjsBuild: EntryBuild = {
  entryNames: ['count-reporter', 'exec', 'playwright'],
  extension: '.cjs',
  format: 'cjs'
};

export const ENTRY_BUILDS: EntryBuild[] = [esmBuild, cjsBuild];

const indexExport: PackageExportConditions = {
  types: './index.d.ts',
  default: './index.js'
};

const countReporterExport: PackageExportConditions = {
  default: './count-reporter.cjs'
};

const execExport: PackageExportConditions = {
  require: './exec.cjs'
};

const playwrightExport: PackageExportConditions = {
  types: './playwright.d.ts',
  import: './playwright.js',
  require: './playwright.cjs'
};

export const PACKAGE_EXPORTS: PackageExportMap = {
  '.': indexExport,
  './count-reporter': countReporterExport,
  './exec': execExport,
  './package.json': './package.json',
  './playwright': playwrightExport,
  './schema.json': './schema.json'
};

export const PACKAGE_BIN: PackageBinMap = {
  'turbo-atomizer': './cli.js'
};

export const PUBLISHED_FILES = ['**/*.js', '**/*.cjs', '**/*.d.ts', 'schema.json'];

export const WORKSPACE_ASSETS = ['LICENSE'];

export const PACKAGE_ASSETS = ['README.md'];

export const CONFIG_SCHEMA_MODULE = 'src/shared/config/common/atomizer-config.schema.ts';

export const DEPENDENCY_FIELDS: DependencyField[] = ['dependencies', 'optionalDependencies', 'peerDependencies'];
