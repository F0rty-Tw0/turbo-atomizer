import { playwrightJsonReportSchema } from '../common/playwright-report.schema.ts';

/** Test files a Playwright JSON report has a suite for, deduped and sorted. */
export const reportedFiles = (text: string): string[] => {
  const raw: unknown = JSON.parse(text);
  const report = playwrightJsonReportSchema.parse(raw);
  const files = report.suites.map((suite): string => suite.file);
  const fileSet = new Set(files);
  const unique = [...fileSet];

  return unique.toSorted();
};
