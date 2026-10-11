import type { DoctorFinding } from '../common/doctor-finding.type.ts';

const isError = (finding: DoctorFinding): boolean => finding.level === 'error';

const counted = (count: number, noun: string): string => {
  const suffix = count === 1 ? '' : 's';

  return `${String(count)} ${noun}${suffix}`;
};

const findingLine = (finding: DoctorFinding): string => `  ${finding.level} ${finding.code}: ${finding.message}`;

export const hasDoctorError = (findings: DoctorFinding[]): boolean => findings.some(isError);

/** One status line per package (`ok`, or the error and warning counts), then one line per finding. */
export const formatDoctorReport = (packageDir: string, findings: DoctorFinding[]): string => {
  if (findings.length === 0) return `${packageDir}: ok\n`;

  const errorCount = findings.filter(isError).length;
  const errors = counted(errorCount, 'error');
  const warnings = counted(findings.length - errorCount, 'warning');
  const findingLines = findings.map(findingLine);
  const lines = [`${packageDir}: ${errors}, ${warnings}`, ...findingLines];

  return `${lines.join('\n')}\n`;
};
