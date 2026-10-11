import type { AtomizerMetadata } from '../../shared/atomizer/common/atomizer.type.ts';
import type { SpecFile } from '../../shared/playwright/common/spec-listing.type.ts';

const BLOB_REPORTER = 'blob';

const isSet = (value: string | null): boolean => value !== null;

/** A file whose tests all belong to setup projects gets no task (spec §6.2 step 3). */
export const isSetupOnlyFile = (file: SpecFile, setupProjects: string[]): boolean => {
  const isSetupProject = (project: string): boolean => setupProjects.includes(project);

  return file.projects.every(isSetupProject);
};

export const needsBlobReporter = (metadata: AtomizerMetadata): boolean => {
  const isBlob = ([name]: [string, unknown]): boolean => name === BLOB_REPORTER;

  return !metadata.reporters.some(isBlob);
};

/** A custom `snapshotPathTemplate` or `snapshotDir` anywhere keeps snapshots a shared input (spec §4). */
export const hasSharedSnapshots = (metadata: AtomizerMetadata): boolean => {
  const hasTemplate = metadata.snapshotPathTemplates.some(isSet);
  const hasDir = metadata.snapshotDirs.some(isSet);

  return hasTemplate || hasDir;
};
