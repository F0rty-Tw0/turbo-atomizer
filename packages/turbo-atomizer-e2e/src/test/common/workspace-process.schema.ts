import { z } from 'zod';

import type { Win32Process } from './workspace-process.type.ts';

const win32ProcessSchema = z.object({
  ProcessId: z.number(),
  ParentProcessId: z.number(),
  Name: z.string(),
  CommandLine: z.string().nullable(),
  CreationDate: z.number()
}) satisfies z.ZodType<Win32Process>;

/** stdout of `ConvertTo-Json -InputObject @(Get-CimInstance Win32_Process | Select-Object …)`, `CreationDate` as Unix ms. */
export const win32ProcessListSchema = z.array(win32ProcessSchema);
