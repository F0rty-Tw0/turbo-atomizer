import { formatSyncError } from '../../sync/utils/sync-summary.util.ts';
import { TURBO_DOCTOR_DEPS, doctorPackage } from '../domain-logic/doctor.ts';
import { formatDoctorReport, hasDoctorError } from '../utils/doctor-report.util.ts';

const doctorOne = async (packageDir: string): Promise<number> => {
  try {
    const findings = await doctorPackage(packageDir, TURBO_DOCTOR_DEPS);
    const report = formatDoctorReport(packageDir, findings);

    process.stdout.write(report);

    return hasDoctorError(findings) ? 1 : 0;
  } catch (error) {
    const line = formatSyncError(packageDir, error);

    process.stderr.write(line);

    return 1;
  }
};

/** Spec §6.4: doctors each package in order; 1 when any package has an error finding or fails, else 0. */
export const doctorHandler = async (packageDirs: string[]): Promise<number> => {
  let exitCode = 0;

  for (const packageDir of packageDirs) {
    const packageExitCode = await doctorOne(packageDir);

    exitCode = Math.max(exitCode, packageExitCode);
  }

  return exitCode;
};
