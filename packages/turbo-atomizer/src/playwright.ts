import type { PlaywrightTestConfig } from '@playwright/test';

import { getAtomizerEnv } from './config/atomizer-env.schema.ts';
import { toStringEnv } from './shared/atomizer/utils/string-env.util.ts';
import { applyAtomizer } from './shared/playwright/utils/apply-atomizer.util.ts';

export const withAtomizer = <TConfig extends PlaywrightTestConfig>(config: TConfig): TConfig => {
  const env = getAtomizerEnv();
  const ci = process.env['CI'];
  const ciDefault = ci !== undefined && ci !== '';
  const processEnv = toStringEnv(process.env);

  return applyAtomizer(config, env, ciDefault, processEnv);
};
