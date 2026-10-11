type DoctorFindingLevel = 'error' | 'warning';

/** Stable finding codes; scripts may match on them. */
type DoctorFindingCode =
  | 'affected-flag-missing'
  | 'app-dependency-missing'
  | 'custom-reporter'
  | 'custom-snapshot-path'
  | 'helper-missing'
  | 'outside-import'
  | 'peer-version'
  | 'root-flag-missing'
  | 'server-unshareable'
  | 'setup-projects'
  | 'spec-rejected'
  | 'stale-generated'
  | 'test-turbo-json-drift'
  | 'turbo-untested';

export type DoctorFinding = {
  readonly level: DoctorFindingLevel;
  readonly code: DoctorFindingCode;
  readonly message: string;
};
