import { z } from 'zod';

import {
  TURBO_ATOMIZER_ARGS_ENV,
  TURBO_ATOMIZER_COUNT_FILE_ENV,
  TURBO_ATOMIZER_DESCRIBE_ENV,
  TURBO_ATOMIZER_ENV,
  TURBO_ATOMIZER_SERVER_ENV_ENV
} from '../shared/atomizer/common/atomizer.const.ts';
import type { AtomizerEnv } from '../shared/atomizer/common/atomizer.type.ts';

const atomizerEnvSchema = z.object({
  [TURBO_ATOMIZER_ARGS_ENV]: z.string().optional(),
  [TURBO_ATOMIZER_COUNT_FILE_ENV]: z.string().min(1).optional(),
  [TURBO_ATOMIZER_DESCRIBE_ENV]: z.string().optional(),
  [TURBO_ATOMIZER_ENV]: z.string().optional(),
  [TURBO_ATOMIZER_SERVER_ENV_ENV]: z.string().optional()
});

export const getAtomizerEnv = (): AtomizerEnv => {
  const result = atomizerEnvSchema.safeParse(process.env);

  if (!result.success) {
    const details = z.prettifyError(result.error);

    throw new Error(`Invalid TURBO_ATOMIZER* environment:\n${details}`, { cause: result.error });
  }

  const env: AtomizerEnv = {
    active: result.data[TURBO_ATOMIZER_ENV] === '1',
    args: result.data[TURBO_ATOMIZER_ARGS_ENV],
    captureServerEnv: result.data[TURBO_ATOMIZER_SERVER_ENV_ENV] === '1',
    countFile: result.data[TURBO_ATOMIZER_COUNT_FILE_ENV],
    describe: result.data[TURBO_ATOMIZER_DESCRIBE_ENV] === '1'
  };

  return env;
};
