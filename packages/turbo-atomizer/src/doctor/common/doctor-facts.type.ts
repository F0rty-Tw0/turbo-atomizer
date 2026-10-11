import type { AtomizerMetadata } from '../../shared/atomizer/common/atomizer.type.ts';
import type { TurboJsonDoc } from '../../shared/turbo/common/turbo-json.type.ts';
import type { PackageTasks } from '../../shared/turbo/common/turbo-query.type.ts';
import type { AtomsDiff } from '../../sync/common/atoms-diff.type.ts';

type DoctorVersions = {
  readonly turbo: string;
  readonly playwright: string;
};

/** A spec import outside the test package; `file` is posix, relative to the workspace root (turbo query's form). */
export type OutsideImport = {
  readonly spec: string;
  readonly file: string;
};

/**
 * Everything doctor checks for one test package, gathered before any check runs.
 * `packageDir` is posix, relative to the workspace root, so it resolves package-relative `extraInputs`
 * against the root-relative paths turbo query reports.
 */
export type DoctorFacts = {
  readonly packageDir: string;
  readonly task: string;
  /** The file-task diff when the generated turbo.json differs from a fresh sync (`sync --check` fails); `undefined` when current. */
  readonly stale: AtomsDiff | undefined;
  readonly rejectedSpecs: string[];
  readonly metadata: AtomizerMetadata | undefined;
  readonly testTurboJson: TurboJsonDoc | undefined;
  readonly generatedName: string;
  readonly taskCommandFlagSet: boolean;
  readonly affectedFlagSet: boolean;
  readonly versions: DoctorVersions;
  readonly dependsOn: string[];
  readonly dependencyTasks: PackageTasks[];
  readonly outsideImports: OutsideImport[];
  readonly extraInputs: string[];
};
