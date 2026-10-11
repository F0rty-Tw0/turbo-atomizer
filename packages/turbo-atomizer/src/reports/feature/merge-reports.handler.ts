import { mergeReports } from '../domain-logic/merge-reports.ts';

const mergePackage = async (packageDir: string, statusReporterPath: string): Promise<number> => {
  try {
    return await mergeReports(packageDir, statusReporterPath);
  } catch (error) {
    process.stderr.write(`turbo-atomizer merge-reports: ${packageDir}: ${String(error)}\n`);

    return 1;
  }
};

/** Merges each package in turn, so one broken package still lets the others report; non-zero if any merge is. */
export const mergeReportsHandler = async (packageDirs: string[], statusReporterPath: string): Promise<number> => {
  let exitCode = 0;

  for (const packageDir of packageDirs) {
    const packageExitCode = await mergePackage(packageDir, statusReporterPath);

    if (packageExitCode !== 0) exitCode = packageExitCode;
  }

  return exitCode;
};
