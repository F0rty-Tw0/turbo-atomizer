import { posix } from 'node:path';

import type { PackageTasks } from '../../shared/turbo/common/turbo-query.type.ts';
import type { DoctorFacts, OutsideImport } from '../common/doctor-facts.type.ts';
import type { DoctorFinding } from '../common/doctor-finding.type.ts';
import { TURBO_ROOT_PREFIX } from '../common/doctor.const.ts';

type InputGlobs = {
  readonly included: string[];
  readonly excluded: string[];
};

const PACKAGE_TASK_SEPARATOR = '#';

const DEPENDENCY_PREFIX = '^';

const NEGATION_PREFIX = '!';

const hasDependencyTask = (entry: string, dependency: PackageTasks): boolean => {
  const isUpstream = entry.startsWith(DEPENDENCY_PREFIX);
  const upstreamTask = entry.slice(DEPENDENCY_PREFIX.length);

  if (isUpstream) return dependency.tasks.includes(upstreamTask);

  const [packageName, taskName] = entry.split(PACKAGE_TASK_SEPARATOR);
  const isNamedPackage = packageName === dependency.name;

  if (!isNamedPackage || taskName === undefined) return false;

  return dependency.tasks.includes(taskName);
};

/** Turns an `extraInputs` entry, without its `!`, into a glob relative to the workspace root. */
const rootGlob = (entry: string, packageDir: string): string => {
  const isRootRelative = entry.startsWith(TURBO_ROOT_PREFIX);

  if (isRootRelative) return entry.slice(TURBO_ROOT_PREFIX.length);

  return posix.join(packageDir, entry);
};

/** Splits `extraInputs` the way turbo applies them: a file is an input when a glob includes it and no negated glob excludes it. */
const inputGlobs = (facts: DoctorFacts): InputGlobs => {
  const isNegated = (entry: string): boolean => entry.startsWith(NEGATION_PREFIX);
  const isIncluding = (entry: string): boolean => !isNegated(entry);
  const toIncludedGlob = (entry: string): string => rootGlob(entry, facts.packageDir);
  const toExcludedGlob = (entry: string): string => rootGlob(entry.slice(NEGATION_PREFIX.length), facts.packageDir);
  const included = facts.extraInputs.filter(isIncluding).map(toIncludedGlob);
  const excluded = facts.extraInputs.filter(isNegated).map(toExcludedGlob);
  const globs: InputGlobs = { included, excluded };

  return globs;
};

const isInputFile = (file: string, globs: InputGlobs): boolean => {
  const matchesFile = (glob: string): boolean => posix.matchesGlob(file, glob);
  const isIncluded = globs.included.some(matchesFile);
  const isExcluded = globs.excluded.some(matchesFile);

  return isIncluded && !isExcluded;
};

const isInDependency = (file: string, dependencies: PackageTasks[]): boolean => {
  return dependencies.some((dependency): boolean => file.startsWith(`${dependency.dir}/`));
};

const isUncoveredImport = (outsideImport: OutsideImport, facts: DoctorFacts, globs: InputGlobs): boolean => {
  const isDependencyFile = isInDependency(outsideImport.file, facts.dependencyTasks);

  if (isDependencyFile) return false;

  return !isInputFile(outsideImport.file, globs);
};

/** An `extraInputs` glob outside the test package may list the app's sources, so the app-dependency check defers to it. */
const reachesOutsidePackage = (facts: DoctorFacts): boolean => {
  const { included } = inputGlobs(facts);
  const isOutside = (glob: string): boolean => !glob.startsWith(`${facts.packageDir}/`);

  return included.some(isOutside);
};

const isAppCovered = (facts: DoctorFacts): boolean => {
  const isCoveredBy = (entry: string): boolean =>
    facts.dependencyTasks.some((dependency): boolean => hasDependencyTask(entry, dependency));

  return facts.dependsOn.some(isCoveredBy);
};

const appFindings = (facts: DoctorFacts): DoctorFinding[] => {
  const webServers = facts.metadata?.webServers ?? [];
  const hasOutsideInput = reachesOutsidePackage(facts);

  if (webServers.length === 0 || hasOutsideInput) return [];

  const isCovered = isAppCovered(facts);

  if (isCovered) return [];

  const dependsOn = facts.dependsOn.join(', ');
  const message = `The config has a web server, but no workspace dependency of the test package has a task matched by dependsOn (${dependsOn}), so app changes do not reach the file hashes. Add the app as a dependency with a build task, or list its sources in extraInputs.`;
  const finding: DoctorFinding = { level: 'error', code: 'app-dependency-missing', message };

  return [finding];
};

const outsideImportFinding = (outsideImport: OutsideImport): DoctorFinding => {
  const message = `${outsideImport.spec} imports ${outsideImport.file}, which is outside the test package, in no workspace dependency and not covered by extraInputs; its changes would not invalidate the cache. Add its package as a dependency or list it in extraInputs.`;
  const finding: DoctorFinding = { level: 'error', code: 'outside-import', message };

  return finding;
};

const importFindings = (facts: DoctorFacts): DoctorFinding[] => {
  const globs = inputGlobs(facts);
  const isUncovered = (outsideImport: OutsideImport): boolean => isUncoveredImport(outsideImport, facts, globs);
  const uncovered = facts.outsideImports.filter(isUncovered);

  return uncovered.map(outsideImportFinding);
};

/** Checks that the app under test and every outside spec import reach the file hashes (spec §8). */
export const checkCoverage = (facts: DoctorFacts): DoctorFinding[] => {
  const appDependencyFindings = appFindings(facts);
  const outsideImportFindings = importFindings(facts);

  return [...appDependencyFindings, ...outsideImportFindings];
};
