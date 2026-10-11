import { z } from 'zod';

import type { Win32CreateResult } from './server.type.ts';

export const win32CreateResultSchema = z.object({
  returnValue: z.number().int(),
  processId: z.number().int()
}) satisfies z.ZodType<Win32CreateResult>;
