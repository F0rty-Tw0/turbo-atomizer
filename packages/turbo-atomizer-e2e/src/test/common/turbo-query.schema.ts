import { z } from 'zod';

const taskSchema = z.object({ name: z.string(), tags: z.array(z.string()) });

/** stdout of `turbo query '{ package(name: …) { tags tasks { items { name tags } } } }'`. */
export const packageQuerySchema = z.object({
  data: z.object({
    package: z.object({
      tags: z.array(z.string()),
      tasks: z.object({ items: z.array(taskSchema) })
    })
  })
});

/** A `turbo-atomizer.json` with every field kept. */
export const atomizerConfigFileSchema = z.looseObject({});
