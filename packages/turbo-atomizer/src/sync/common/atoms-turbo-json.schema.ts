import { z } from 'zod';

export const atomsTurboJsonSchema = z.object({
  tasks: z.record(z.string(), z.unknown())
});

export const taggedTaskSchema = z.object({
  tags: z.array(z.string())
});
