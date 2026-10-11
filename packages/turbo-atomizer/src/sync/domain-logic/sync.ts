import { join, resolve } from 'node:path';

import type { AtomizerConfig } from '../../shared/config/common/atomizer-config.type.ts';
import { loadAtomizerConfig } from '../../shared/config/domain-logic/atomizer-config.ts';
import type { SpecFile } from '../../shared/playwright/common/spec-listing.type.ts';
import { listSpecs } from '../../shared/playwright/data-access/playwright-list.process.ts';
import { findWorkspaceRoot } from '../../shared/turbo/data-access/workspace-root.store.ts';
import type { AtomTask, AtomTaskInput } from '../common/atom-task.type.ts';
import { HelperMissingException } from '../common/helper-missing.exception.ts';
import { SpecRejectedException } from '../common/spec-rejected.exception.ts';
import type { SyncOptions, SyncResult } from '../common/sync.type.ts';
import { readAtomsFile, writeAtomsFile } from '../data-access/atoms-file.store.ts';
import { buildAtomTask } from '../utils/atom-task.util.ts';
import { diffAtoms } from '../utils/atoms-diff.util.ts';
import { renderAtomsTurboJson } from '../utils/atoms-turbo-json.util.ts';
import { toListLine } from '../utils/list-line.util.ts';
import { validateListLine, validateSpecLocation, validateTaskPath } from '../utils/spec-validation.util.ts';
import { hasSharedSnapshots, isSetupOnlyFile, needsBlobReporter } from '../utils/sync-metadata.util.ts';

type SyncContext = {
  readonly config: AtomizerConfig;
  readonly configInFile: boolean;
  readonly needsBlob: boolean;
  readonly packageDir: string;
  readonly rootDir: string;
  readonly snapshotsShared: boolean;
};

const ATOMS_TURBO_JSON = 'turbo.json';

const toAtomTaskInput = (file: SpecFile, context: SyncContext): AtomTaskInput => {
  const { config, configInFile, needsBlob, snapshotsShared } = context;
  const taskPath = toListLine(file.absPath, context.packageDir);
  const listLine = toListLine(file.absPath, context.rootDir);
  const locationError = validateSpecLocation(taskPath, config.specGlobs);
  const taskPathError = validateTaskPath(taskPath);
  const listLineError = validateListLine(listLine);
  const rejection = locationError ?? taskPathError ?? listLineError;

  if (rejection !== undefined) throw new SpecRejectedException(file.absPath, rejection);

  const input: AtomTaskInput = { config, configInFile, listLine, needsBlob, snapshotsShared, taskPath };

  return input;
};

const renderPackage = async (packageDir: string, config: AtomizerConfig, configInFile: boolean): Promise<string> => {
  const listing = await listSpecs(packageDir, config.playwrightConfig);
  const { metadata, rootDir } = listing;

  if (metadata === undefined) throw new HelperMissingException(packageDir, config.playwrightConfig);

  const needsBlob = needsBlobReporter(metadata);
  const snapshotsShared = hasSharedSnapshots(metadata);
  const context: SyncContext = { config, configInFile, needsBlob, packageDir, rootDir, snapshotsShared };
  const isSpecFile = (file: SpecFile): boolean => !isSetupOnlyFile(file, metadata.setupProjects);

  const toAtomTask = (file: SpecFile): AtomTask => {
    const input = toAtomTaskInput(file, context);

    return buildAtomTask(input);
  };

  const atomTasks = listing.files.filter(isSpecFile).map(toAtomTask);

  return renderAtomsTurboJson(atomTasks, config.task);
};

/** Regenerates the generated package's turbo.json for one test package (spec §6.2); `check` never writes. */
export const syncPackage = async (packageDir: string, options: SyncOptions): Promise<SyncResult> => {
  const absPackageDir = resolve(packageDir);
  const { config, source } = await loadAtomizerConfig(absPackageDir);
  const workspaceRoot = await findWorkspaceRoot(absPackageDir);
  const after = await renderPackage(absPackageDir, config, source === 'file');
  const atomsFile = join(workspaceRoot, config.generatedPackage, ATOMS_TURBO_JSON);
  const before = await readAtomsFile(atomsFile);
  const diff = diffAtoms(before, after, config.task);
  const isStale = before !== after;
  const shouldWrite = isStale && !options.check;

  if (shouldWrite) await writeAtomsFile(atomsFile, after);

  const result: SyncResult = { diff, stale: isStale && options.check, written: shouldWrite };

  return result;
};
