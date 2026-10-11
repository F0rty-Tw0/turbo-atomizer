import { z } from 'zod';

import type { ListedSuite, PlaywrightListReport } from './spec-listing.type.ts';
import type { AtomizerMetadata } from '../../atomizer/common/atomizer.type.ts';

const regexFactSchema = z.object({ flags: z.string(), source: z.string() });

const waitFactSchema = z.object({
  stderr: regexFactSchema.optional(),
  stdout: regexFactSchema.optional()
});

const gracefulShutdownFactSchema = z.object({
  signal: z.enum(['SIGINT', 'SIGTERM']),
  timeout: z.number()
});

const webServerFactSchema = z.object({
  command: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  gracefulShutdown: gracefulShutdownFactSchema.optional(),
  ignoreHTTPSErrors: z.boolean().optional(),
  port: z.number().optional(),
  timeout: z.number().optional(),
  url: z.string().optional(),
  wait: waitFactSchema.optional()
});

const reporterFactSchema = z.tuple([z.string(), z.unknown()]);

const atomizerMetadataSchema: z.ZodType<AtomizerMetadata> = z.object({
  reporters: z.array(reporterFactSchema),
  serverEnv: z.record(z.string(), z.string()).exactOptional(),
  setupProjects: z.array(z.string()),
  snapshotDirs: z.array(z.string().nullable()),
  snapshotPathTemplates: z.array(z.string().nullable()),
  version: z.literal(1),
  webServers: z.array(webServerFactSchema)
});

const listedTestSchema = z.object({ projectName: z.string() });

const listedSpecSchema = z.object({ tests: z.array(listedTestSchema) });

const listedSuiteSchema: z.ZodType<ListedSuite> = z.lazy(() => {
  return z.object({
    file: z.string(),
    specs: z.array(listedSpecSchema),
    suites: z.array(listedSuiteSchema).optional()
  });
});

const listedConfigMetadataSchema = z.object({ 'turbo-atomizer': atomizerMetadataSchema.optional() });

const listedConfigSchema = z.object({
  metadata: listedConfigMetadataSchema,
  rootDir: z.string()
});

export const playwrightListReportSchema: z.ZodType<PlaywrightListReport> = z.object({
  config: listedConfigSchema,
  suites: z.array(listedSuiteSchema)
});
