import { formatSyncResult } from '../../sync/utils/sync-summary.util.ts';
import type { InitReport } from '../common/init.type.ts';

/** The setup steps init leaves to the user when the Playwright config is not wrapped yet (spec §6.1 step 11). */
export const initNextSteps = (playwrightConfig: string, packageName: string): string[] => {
  const steps = [
    `Wrap the default export of ${playwrightConfig} in withAtomizer() from 'turbo-atomizer/playwright'.`,
    `Declare the app under test as a workspace dependency of ${packageName}.`,
    `Build the workspace dependencies: turbo run build --filter=${packageName}^...`,
    'Run turbo-atomizer sync.'
  ];

  return steps;
};

const numbered = (step: string, index: number): string => `  ${String(index + 1)}. ${step}`;

const summaryLines = (report: InitReport): string[] => {
  const hasChanges = report.changes.length > 0;
  const status = hasChanges ? 'initialized' : 'already initialized; nothing changed';
  const warningLines = report.warnings.map((warning): string => `  warning: ${warning}`);
  const changeLines = report.changes.map((change): string => `  changed: ${change}`);
  const lines = [`${report.packageDir}: ${status}`, ...warningLines, ...changeLines];

  if (hasChanges) lines.push(`Commit ${report.lockfile} with these changes; the install added the generated package to it.`);

  return lines;
};

/** What init printed for one package: status, warnings, changed files, then the sync result or the next steps (step 12). */
export const formatInitReport = (report: InitReport): string => {
  const summary = `${summaryLines(report).join('\n')}\n`;

  if (report.sync !== undefined) return `${summary}${formatSyncResult(report.packageDir, report.sync)}`;

  const stepLines = report.nextSteps.map(numbered);

  return `${summary}Next steps:\n${stepLines.join('\n')}\n`;
};
