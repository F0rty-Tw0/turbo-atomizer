import type { AffectedOptions } from '../common/affected.type.ts';
import { TURBO_AFFECTED_DEPS, affectedPackage } from '../domain-logic/affected.ts';

/** Spec §6.6: handles every test package in order and returns the first non-zero turbo exit code, else 0. */
export const affectedHandler = async (packageDirs: string[], options: AffectedOptions): Promise<number> => {
  let firstFailure = 0;

  for (const packageDir of packageDirs) {
    const code = await affectedPackage(packageDir, options.forwarded, TURBO_AFFECTED_DEPS);

    if (firstFailure === 0) firstFailure = code;
  }

  return firstFailure;
};
