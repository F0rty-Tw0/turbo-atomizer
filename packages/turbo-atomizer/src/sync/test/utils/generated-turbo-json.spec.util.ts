import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import type { TurboTaskDefinition } from '../../common/atom-task.type.ts';

type GeneratedTasks = Record<string, TurboTaskDefinition>;

const stringList = z.array(z.string()).exactOptional();

const optionalBoolean = z.boolean().exactOptional();

const taskSchema = z.object({
  cache: optionalBoolean,
  command: stringList,
  dependsOn: stringList,
  env: stringList,
  inputs: stringList,
  outputs: stringList,
  passThroughEnv: stringList,
  tags: stringList
}) satisfies z.ZodType<TurboTaskDefinition>;

const generatedTurboJsonSchema = z.object({
  tasks: z.record(z.string(), taskSchema)
});

/** Reads the generated package's turbo.json and returns its tasks, validated. */
export const readGeneratedTasks = async (filePath: string): Promise<GeneratedTasks> => {
  const text = await readFile(filePath, 'utf8');
  const raw: unknown = JSON.parse(text);
  const generated = generatedTurboJsonSchema.parse(raw);

  return generated.tasks;
};
