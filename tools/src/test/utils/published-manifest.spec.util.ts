import { DEPENDENCY_FIELDS } from '../../common/build-package.const.ts';
import type { DependencyField, PackageExportConditions, PackageExportMap, PackageManifest } from '../../common/build-package.type.ts';

const isDefined = (target: string | undefined): target is string => target !== undefined;

const isConditions = (entry: PackageExportMap[string]): entry is PackageExportConditions => typeof entry !== 'string';

const isCjs = (target: string): boolean => target.endsWith('.cjs');

const isJs = (target: string): boolean => target.endsWith('.js');

const entryTargets = (entry: PackageExportMap[string]): string[] => {
  if (!isConditions(entry)) return [entry];

  const targets = Object.values(entry);

  return targets.filter(isDefined);
};

const exportConditions = (manifest: PackageManifest): PackageExportConditions[] => {
  const entries = Object.values(manifest.exports ?? {});

  return entries.filter(isConditions);
};

const requireCondition = (conditions: PackageExportConditions): string | undefined => conditions.require;

const importConditions = (conditions: PackageExportConditions): (string | undefined)[] => [conditions.import, conditions.default];

export const exportTargets = (manifest: PackageManifest): string[] => {
  const entries = Object.values(manifest.exports ?? {});

  return entries.flatMap(entryTargets);
};

export const binTargets = (manifest: PackageManifest): string[] => Object.values(manifest.bin ?? {});

export const requireTargets = (manifest: PackageManifest): string[] => {
  const conditions = exportConditions(manifest);
  const required = conditions.map(requireCondition).filter(isDefined);
  const cjsTargets = exportTargets(manifest).filter(isCjs);
  const targets = new Set([...required, ...cjsTargets]);

  return [...targets];
};

export const importTargets = (manifest: PackageManifest): string[] => {
  const conditions = exportConditions(manifest);
  const imported = conditions.flatMap(importConditions).filter(isDefined);
  const targets = new Set(imported.filter(isJs));

  return [...targets];
};

export const catalogSpecifiers = (manifest: PackageManifest): string[] => {
  const fieldSpecifiers = (field: DependencyField): string[] => {
    const dependencies = Object.entries(manifest[field] ?? {});
    const catalogDependencies = dependencies.filter(([, specifier]): boolean => specifier.startsWith('catalog:'));

    return catalogDependencies.map(([name, specifier]): string => `${field}.${name}: ${specifier}`);
  };

  return DEPENDENCY_FIELDS.flatMap(fieldSpecifiers);
};
