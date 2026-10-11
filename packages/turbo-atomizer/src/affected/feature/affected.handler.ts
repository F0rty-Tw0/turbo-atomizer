import { constants } from 'node:os';

import type { AffectedOptions } from '../common/affected.type.ts';
import { TURBO_AFFECTED_DEPS, affectedPackage } from '../domain-logic/affected.ts';

const INTERRUPT_EXIT_CODES = [128 + constants.signals.SIGINT, 128 + constants.signals.SIGTERM];

/**
 * Spec §6.6: handles every test package in order and returns the first non-zero turbo exit code, else 0.
 * A SIGINT or SIGTERM during a run (Ctrl+C) stops the loop and returns its code.
 */
export const affectedHandler = async (packageDirs: string[], options: AffectedOptions): Promise<number> => {
  let firstFailure = 0;

  for (const packageDir of packageDirs) {
    const code = await affectedPackage(packageDir, options.forwarded, TURBO_AFFECTED_DEPS);
    const isInterrupt = INTERRUPT_EXIT_CODES.includes(code);

    if (isInterrupt) return code;

    if (firstFailure === 0) firstFailure = code;
  }

  return firstFailure;
};
