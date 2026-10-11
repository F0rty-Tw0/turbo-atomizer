import { z } from 'zod';

const reportSuiteSchema = z.object({ file: z.string() });

/** A Playwright JSON report; only the top-level suites, one per test file, which the e2e reads. */
export const playwrightJsonReportSchema = z.object({ suites: z.array(reportSuiteSchema) });
