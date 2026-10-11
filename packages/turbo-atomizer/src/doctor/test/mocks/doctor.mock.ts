import { vi } from 'vitest';

import type { DoctorDeps } from '../../common/doctor-facts.type.ts';
import { WEB_PACKAGE_TASKS_STUB } from '../stubs/doctor-facts.stub.ts';

/** No spec imports anything; the test package depends on `web`, which has a build task. */
export const doctorDepsMock = (): DoctorDeps => {
  const queryFileDeps = vi.fn<DoctorDeps['queryFileDeps']>().mockResolvedValue([]);
  const queryPackageTasks = vi.fn<DoctorDeps['queryPackageTasks']>().mockResolvedValue([WEB_PACKAGE_TASKS_STUB]);
  const deps: DoctorDeps = { queryFileDeps, queryPackageTasks };

  return deps;
};
