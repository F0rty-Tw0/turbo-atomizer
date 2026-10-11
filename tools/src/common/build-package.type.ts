import type { Format } from 'esbuild';

export type PackageDependencyMap = Record<string, string>;

export type PackageBinMap = Record<string, string>;

export type PackageExportConditions = {
  readonly default?: string;
  readonly import?: string;
  readonly require?: string;
  readonly types?: string;
};

type PackageExport = PackageExportConditions | string;

export type PackageExportMap = Record<string, PackageExport>;

export type PackageManifest = {
  readonly bin?: PackageBinMap;
  readonly dependencies?: PackageDependencyMap;
  readonly devDependencies?: PackageDependencyMap;
  readonly exports?: PackageExportMap;
  readonly files?: string[];
  readonly name: string;
  readonly nx?: unknown;
  readonly optionalDependencies?: PackageDependencyMap;
  readonly peerDependencies?: PackageDependencyMap;
  readonly private?: boolean;
  readonly scripts?: PackageDependencyMap;
  readonly version: string;
  readonly [field: string]: unknown;
};

export type DependencyField = 'dependencies' | 'optionalDependencies' | 'peerDependencies';

export type EntryBuild = {
  readonly entryNames: string[];
  readonly extension: string;
  readonly format: Format;
};

export type BuildPackageContext = {
  readonly manifest: PackageManifest;
  readonly outputRoot: string;
  readonly packageRoot: string;
  readonly workspaceRoot: string;
};
