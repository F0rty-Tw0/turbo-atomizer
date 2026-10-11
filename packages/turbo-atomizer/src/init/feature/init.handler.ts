import type { InitHandlerOptions } from '../common/init.type.ts';
import { runInit } from '../domain-logic/init.ts';
import { formatInitReport } from '../utils/init-summary.util.ts';

const reasonOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  return String(error);
};

const initOne = async (packageDir: string, options: InitHandlerOptions): Promise<number> => {
  try {
    const report = await runInit({ ...options, packageDir });

    process.stdout.write(formatInitReport(report));

    return 0;
  } catch (error) {
    process.stderr.write(`turbo-atomizer init: ${reasonOf(error)}\n`);

    return 1;
  }
};

/** Spec §6.1: initializes each package in order (the CLI passes one); 1 when any fails, else 0. */
export const initHandler = async (packageDirs: string[], options: InitHandlerOptions): Promise<number> => {
  let exitCode = 0;

  for (const packageDir of packageDirs) {
    const packageExitCode = await initOne(packageDir, options);

    exitCode = Math.max(exitCode, packageExitCode);
  }

  return exitCode;
};
