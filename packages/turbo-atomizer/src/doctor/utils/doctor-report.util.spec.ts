import { describe, expect, it } from 'vitest';

import { formatDoctorReport, hasDoctorError } from './doctor-report.util.ts';
import type { DoctorFinding } from '../common/doctor-finding.type.ts';

const rootFlagError: DoctorFinding = { level: 'error', code: 'root-flag-missing', message: 'Set the flag.' };

const setupWarning: DoctorFinding = { level: 'warning', code: 'setup-projects', message: 'Setup runs per file.' };

const reporterWarning: DoctorFinding = { level: 'warning', code: 'custom-reporter', message: 'Custom reporter.' };

const EXPECTED_REPORT = `apps/web-e2e: 1 error, 2 warnings
  error root-flag-missing: Set the flag.
  warning setup-projects: Setup runs per file.
  warning custom-reporter: Custom reporter.
`;

describe('FEATURE: doctor report', (): void => {
  describe('GIVEN no findings', (): void => {
    it('WHEN formatted THEN the package is reported ok', (): void => {
      const report = formatDoctorReport('apps/web-e2e', []);

      expect(report).toBe('apps/web-e2e: ok\n');
    });

    it('WHEN checked for errors THEN there are none', (): void => {
      const hasError = hasDoctorError([]);

      expect(hasError).toBe(false);
    });
  });

  describe('GIVEN one error and two warnings', (): void => {
    const findings = [rootFlagError, setupWarning, reporterWarning];

    it('WHEN formatted THEN a count line is followed by one line per finding with its level and code', (): void => {
      const report = formatDoctorReport('apps/web-e2e', findings);

      expect(report).toBe(EXPECTED_REPORT);
    });

    it('WHEN checked for errors THEN there is one', (): void => {
      const hasError = hasDoctorError(findings);

      expect(hasError).toBe(true);
    });
  });

  describe('GIVEN only one warning', (): void => {
    it('WHEN formatted THEN the count line names no errors and one warning', (): void => {
      const report = formatDoctorReport('apps/web-e2e', [setupWarning]);

      expect(report).toContain('apps/web-e2e: 0 errors, 1 warning\n');
    });

    it('WHEN checked for errors THEN there are none', (): void => {
      const hasError = hasDoctorError([setupWarning]);

      expect(hasError).toBe(false);
    });
  });
});
