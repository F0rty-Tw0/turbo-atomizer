import { z } from 'zod';

import { E2E_PM_ENV, E2E_TURBO_VERSION_ENV } from './fixture-workspace.const.ts';

/** The `ATOMIZER_E2E_*` variables; the rest of `process.env` is ignored. */
export const e2eEnvSchema = z.object({
  [E2E_PM_ENV]: z.enum(['npm', 'pnpm']).optional(),
  [E2E_TURBO_VERSION_ENV]: z.string().min(1).optional()
});
