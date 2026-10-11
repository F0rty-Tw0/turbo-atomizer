import { join, resolve } from 'node:path';

import { generatedPackageFor } from '../../init/utils/generated-package.util.ts';
import { loadAtomizerConfig } from '../../shared/config/domain-logic/atomizer-config.ts';
import { listSpecs } from '../../shared/playwright/data-access/playwright-list.process.ts';
import { getPlaywrightVersion } from '../../shared/playwright/data-access/playwright-version.path.ts';
import { readTurboJson } from '../../shared/turbo/data-access/turbo-json.store.ts';
import { getTurboVersion } from '../../shared/turbo/data-access/turbo-version.path.ts';
import { findWorkspaceRoot } from '../../shared/turbo/data-access/workspace-root.store.ts';
import { readPackageName } from '../../shared/workspace/data-access/package-name.store.ts';
import type { AtomsDiff } from '../../sync/common/atoms-diff.type.ts';
import { HelperMissingException } from '../../sync/common/helper-missing.exception.ts';
import { SpecRejectedException } from '../../sync/common/spec-rejected.exception.ts';
import { readAtomsFile } from '../../sync/data-access/atoms-file.store.ts';
import { syncPackage } from '../../sync/domain-logic/sync.ts';
import { toListLine } from '../../sync/utils/list-line.util.ts';
import type { DoctorDeps, DoctorFacts, OutsideImport } from '../common/doctor-facts.type.ts';
import { PackageNameMissingException } from '../common/package-name-missing.exception.ts';
import { hasFutureFlag, readFileTaskPaths, toOutsideImports } from '../utils/doctor-facts.util.ts';

type SyncStatus = {
  readonly stale: AtomsDiff | undefined;
  readonly rejectedSpecs: string[];
};

type TurboScan = {
  readonly atomsFile: string;
  readonly isQueryable: boolean;
  readonly isStale: boolean;
  readonly packageDir: string;
  readonly packageName: string;
  readonly root: string;
  readonly task: string;
};

type TurboFacts = Pick<DoctorFacts, 'dependencyTasks' | 'outsideImports'>;

const ATOMS_TURBO_JSON = 'turbo.json';

const TASK_COMMAND_FLAG = 'experimentalTaskCommand';

const AFFECTED_FLAG = 'affectedUsingTaskInputs';

const UNKNOWN_SYNC_STATUS: SyncStatus = { stale: undefined, rejectedSpecs: [] };

const NO_TURBO_FACTS: TurboFacts = { dependencyTasks: [], outsideImports: [] };

/** `sync --check` (spec §6.4): a rejected spec or a missing helper becomes a fact for the checks, not a failure. */
const checkSync = async (packageDir: string): Promise<SyncStatus> => {
  try {
    const result = await syncPackage(packageDir, { check: true });
    const stale = result.stale ? result.diff : undefined;
    const status: SyncStatus = { stale, rejectedSpecs: [] };

    return status;
  } catch (error) {
    if (error instanceof HelperMissingException) return UNKNOWN_SYNC_STATUS;

    if (!(error instanceof SpecRejectedException)) throw error;

    const rejectedSpec = toListLine(error.file, packageDir);
    const status: SyncStatus = { stale: undefined, rejectedSpecs: [rejectedSpec] };

    return status;
  }
};

/**
 * Specs come from the generated file tasks; one `turbo query` per spec, in order, so a large suite never spawns turbo in bulk.
 * A stale generated file may list a deleted spec, which turbo cannot query; stale is already an error, so nothing is scanned then.
 */
const scanOutsideImports = async (scan: TurboScan, deps: DoctorDeps): Promise<OutsideImport[]> => {
  if (scan.isStale) return [];

  const atomsText = await readAtomsFile(scan.atomsFile);
  const specs = readFileTaskPaths(atomsText, scan.task);
  const outsideImports: OutsideImport[] = [];

  for (const spec of specs) {
    const files = await deps.queryFileDeps(scan.root, `${scan.packageDir}/${spec}`);
    const specImports = toOutsideImports(spec, files, scan.packageDir);

    outsideImports.push(...specImports);
  }

  return outsideImports;
};

/** Turbo rejects the generated `command` fields without `experimentalTaskCommand`, so it is not queried at all then. */
const queryTurboFacts = async (scan: TurboScan, deps: DoctorDeps): Promise<TurboFacts> => {
  if (!scan.isQueryable) return NO_TURBO_FACTS;

  const dependencyTasks = await deps.queryPackageTasks(scan.root, scan.packageName);
  const outsideImports = await scanOutsideImports(scan, deps);
  const turboFacts: TurboFacts = { dependencyTasks, outsideImports };

  return turboFacts;
};

/** Gathers everything doctor checks for one test package (spec §6.4); nothing here decides a finding. */
export const gatherDoctorFacts = async (packageDir: string, deps: DoctorDeps): Promise<DoctorFacts> => {
  const absPackageDir = resolve(packageDir);
  const packageName = await readPackageName(absPackageDir);

  if (packageName === undefined) throw new PackageNameMissingException(absPackageDir);

  const { config } = await loadAtomizerConfig(absPackageDir);
  const root = await findWorkspaceRoot(absPackageDir);
  const rootPackageDir = toListLine(absPackageDir, root);
  const { stale, rejectedSpecs } = await checkSync(absPackageDir);
  const listing = await listSpecs(absPackageDir, config.playwrightConfig, { metadataOnly: true });
  const testTurboJson = await readTurboJson(absPackageDir);
  const rootTurboJson = await readTurboJson(root);
  const turbo = await getTurboVersion(root);
  const playwright = getPlaywrightVersion(absPackageDir);
  const taskCommandFlagSet = hasFutureFlag(rootTurboJson, TASK_COMMAND_FLAG);
  const atomsFile = join(root, config.generatedPackage, ATOMS_TURBO_JSON);
  const isStale = stale !== undefined;
  const scan: TurboScan = {
    atomsFile,
    isQueryable: taskCommandFlagSet,
    isStale,
    packageDir: rootPackageDir,
    packageName,
    root,
    task: config.task
  };
  const { dependencyTasks, outsideImports } = await queryTurboFacts(scan, deps);
  const generated = generatedPackageFor(packageName, absPackageDir);
  const versions = { turbo, playwright };
  const facts: DoctorFacts = {
    packageDir: rootPackageDir,
    task: config.task,
    stale,
    rejectedSpecs,
    metadata: listing.metadata,
    testTurboJson,
    generatedName: generated.name,
    taskCommandFlagSet,
    affectedFlagSet: hasFutureFlag(rootTurboJson, AFFECTED_FLAG),
    versions,
    dependsOn: config.dependsOn,
    dependencyTasks,
    outsideImports,
    extraInputs: config.extraInputs
  };

  return facts;
};
