import { gatherDoctorFacts } from './doctor-facts.ts';
import { turboQueryFileDeps, turboQueryPackageTasks } from '../../shared/turbo/data-access/turbo-query.process.ts';
import type { DoctorDeps } from '../common/doctor-facts.type.ts';
import type { DoctorFinding } from '../common/doctor-finding.type.ts';
import { runDoctorChecks } from '../utils/doctor-checks.util.ts';

export const TURBO_DOCTOR_DEPS: DoctorDeps = { queryFileDeps: turboQueryFileDeps, queryPackageTasks: turboQueryPackageTasks };

/** Spec §6.4: every finding for one test package; any `error` finding fails doctor. */
export const doctorPackage = async (packageDir: string, deps: DoctorDeps): Promise<DoctorFinding[]> => {
  const facts = await gatherDoctorFacts(packageDir, deps);

  return runDoctorChecks(facts);
};
