import type { AtomizerMetadata, WebServerFact } from '../../shared/atomizer/common/atomizer.type.ts';
import type { DoctorFinding } from '../common/doctor-finding.type.ts';
import { BUILT_IN_REPORTERS } from '../common/doctor.const.ts';

const isUnshareable = (server: WebServerFact): boolean => server.url === undefined && server.port === undefined;

const isCustomReporter = (reporter: [string, unknown]): boolean => !BUILT_IN_REPORTERS.includes(reporter[0]);

const isSet = (value: string | null): boolean => value !== null;

const unshareableFinding = (server: WebServerFact): DoctorFinding => {
  const message = `Web server "${server.command}" has neither url nor port, so it cannot be shared; every file run would start its own copy. Set url or port.`;
  const finding: DoctorFinding = { level: 'error', code: 'server-unshareable', message };

  return finding;
};

const customReporterFinding = (reporter: [string, unknown]): DoctorFinding => {
  const message = `Reporter "${reporter[0]}" is not built in; it gets no per-file output redirect, so it must not write to a fixed path.`;
  const finding: DoctorFinding = { level: 'warning', code: 'custom-reporter', message };

  return finding;
};

const setupFindings = (setupProjects: string[]): DoctorFinding[] => {
  if (setupProjects.length === 0) return [];

  const names = setupProjects.join(', ');
  const message = `Setup projects (${names}) run once per spec file, not once per suite.`;
  const finding: DoctorFinding = { level: 'warning', code: 'setup-projects', message };

  return [finding];
};

const snapshotFindings = (metadata: AtomizerMetadata): DoctorFinding[] => {
  const hasSnapshotDir = metadata.snapshotDirs.some(isSet);
  const hasPathTemplate = metadata.snapshotPathTemplates.some(isSet);

  if (!hasSnapshotDir && !hasPathTemplate) return [];

  const message =
    'A custom snapshotDir or snapshotPathTemplate is set; snapshots outside the default `<spec>-snapshots/` folders are an input shared by every file task.';
  const finding: DoctorFinding = { level: 'warning', code: 'custom-snapshot-path', message };

  return [finding];
};

/** Checks the `withAtomizer` metadata: unshareable web servers, setup projects, custom snapshot paths and custom reporters. */
export const checkMetadata = (metadata: AtomizerMetadata): DoctorFinding[] => {
  const serverFindings = metadata.webServers.filter(isUnshareable).map(unshareableFinding);
  const setupProjectFindings = setupFindings(metadata.setupProjects);
  const snapshotPathFindings = snapshotFindings(metadata);
  const reporterFindings = metadata.reporters.filter(isCustomReporter).map(customReporterFinding);

  return [...serverFindings, ...setupProjectFindings, ...snapshotPathFindings, ...reporterFindings];
};
