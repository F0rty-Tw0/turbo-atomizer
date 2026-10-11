import { z } from 'zod';

import type { ParsedAtomizerConfig } from './atomizer-config.type.ts';
import {
  DEFAULT_DEPENDS_ON,
  DEFAULT_SERVER_IDLE_MS,
  DEFAULT_SNAPSHOT_GLOBS,
  DEFAULT_SPEC_GLOBS,
  DEFAULT_TASK
} from '../../atomizer/common/atomizer.const.ts';

const stringList = z.array(z.string().min(1));

const TASK_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.:-]*$/;
const TASK_NAME_MESSAGE =
  'Task name must start with a letter, digit or "_" and hold only letters, digits, "_", ".", ":" or "-"; turbo reads "#" as package#task and "^" as a dependency marker.';

const uncachedSchema = z.object({
  commitEnv: z.string().min(1).exactOptional().describe('Live specs stay cacheable with this var in env.'),
  patterns: stringList.default([]).describe('Specs matching these carry atomizer:live and get cache: false.')
});

const serverSchema = z.object({
  idleMs: z.number().int().nonnegative().default(DEFAULT_SERVER_IDLE_MS).describe('Supervisor idle shutdown delay.')
});

export const atomizerConfigSchema = z.object({
  dependsOn: stringList.default(DEFAULT_DEPENDS_ON).describe('Dependencies of every file task.'),
  env: stringList.default([]).describe('Hashed env vars.'),
  extraInputs: stringList.default([]).describe("Copied verbatim into every task's inputs."),
  failOnFlaky: z.boolean().default(false).describe('Adds --fail-on-flaky-tests.'),
  generatedPackage: z.string().min(1).exactOptional().describe('Generated package path, from the workspace root.'),
  passThroughEnv: stringList.default([]).describe('Unhashed env vars passed through strict env mode.'),
  playwrightConfig: z.string().min(1).exactOptional().describe('Playwright config file in the test package root.'),
  server: serverSchema.default({ idleMs: DEFAULT_SERVER_IDLE_MS }),
  snapshotGlobs: stringList.default(DEFAULT_SNAPSHOT_GLOBS).describe('Snapshot folders excluded from task inputs.'),
  specGlobs: stringList.default(DEFAULT_SPEC_GLOBS).describe('Spec files excluded from task inputs.'),
  task: z.string().regex(TASK_NAME, TASK_NAME_MESSAGE).default(DEFAULT_TASK).describe('Umbrella task name and task-name prefix.'),
  uncached: uncachedSchema.default({ patterns: [] })
}) satisfies z.ZodType<ParsedAtomizerConfig>;
