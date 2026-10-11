import { z } from 'zod';

import type { TurboJsonContent } from './turbo-json.type.ts';

export const turboJsonSchema: z.ZodType<TurboJsonContent> = z.looseObject({
  extends: z.array(z.string()).optional(),
  futureFlags: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  tasks: z.record(z.string(), z.unknown()).optional()
});
