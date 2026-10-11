import { z } from 'zod';

import type { LockOwner } from './server.type.ts';

export const lockOwnerSchema = z.object({
  pid: z.number().int().positive(),
  startTime: z.string()
}) satisfies z.ZodType<LockOwner>;
