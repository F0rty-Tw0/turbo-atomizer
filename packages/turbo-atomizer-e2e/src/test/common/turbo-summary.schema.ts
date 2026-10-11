import { z } from 'zod';

const cacheSchema = z.object({ status: z.string() });

const executionSchema = z.object({
  startTime: z.number(),
  endTime: z.number(),
  exitCode: z.number().optional()
});

const taskSchema = z.object({
  taskId: z.string(),
  hash: z.string(),
  inputs: z.record(z.string(), z.string()),
  cache: cacheSchema,
  execution: executionSchema.optional()
});

/** A run summary (`.turbo/runs/<id>.json`) or the stdout of `turbo run --dry=json`; only the fields the e2e reads. */
export const turboRunSchema = z.object({ tasks: z.array(taskSchema) });

/** stdout of `npm pack --json`. */
export const npmPackSchema = z.array(z.object({ filename: z.string() }));

/** A root `package.json` with its other fields kept. */
export const rootManifestSchema = z.looseObject({ devDependencies: z.record(z.string(), z.string()) });
