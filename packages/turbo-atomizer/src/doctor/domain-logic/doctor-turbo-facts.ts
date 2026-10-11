import { readFileTaskPaths } from '../../shared/atomizer/utils/file-tasks.util.ts';
import { TurboQueryException } from '../../shared/turbo/common/turbo-query.exception.ts';
import { readAtomsFile } from '../../sync/data-access/atoms-file.store.ts';
import type { DoctorDeps, OutsideImport, TurboFacts, TurboScan } from '../common/doctor-facts.type.ts';
import { toOutsideImports } from '../utils/doctor-facts.util.ts';

const NO_TURBO_FACTS: TurboFacts = { dependencyTasks: [], outsideImports: [], turboQueryFailure: undefined };

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

/**
 * Turbo rejects the generated `command` fields without `experimentalTaskCommand`, so it is not queried at all then.
 * A failed query (e.g. the generated package was deleted) becomes a fact, so the other checks still report.
 */
export const queryTurboFacts = async (scan: TurboScan, deps: DoctorDeps): Promise<TurboFacts> => {
  if (!scan.isQueryable) return NO_TURBO_FACTS;

  try {
    const dependencyTasks = await deps.queryPackageTasks(scan.root, scan.packageName);
    const outsideImports = await scanOutsideImports(scan, deps);
    const turboFacts: TurboFacts = { dependencyTasks, outsideImports, turboQueryFailure: undefined };

    return turboFacts;
  } catch (error) {
    if (!(error instanceof TurboQueryException)) throw error;

    const failedFacts: TurboFacts = { ...NO_TURBO_FACTS, turboQueryFailure: error.message };

    return failedFacts;
  }
};
