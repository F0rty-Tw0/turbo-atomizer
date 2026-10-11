import { e2eEnvSchema } from '../common/e2e-env.schema.ts';
import { E2E_PM_ENV, E2E_TURBO_VERSION_ENV } from '../common/fixture-workspace.const.ts';
import type { E2eEnv, PackageManager } from '../common/fixture-workspace.type.ts';

/** The `ATOMIZER_E2E_*` settings; throws on an unknown package manager so a CI typo cannot skip every case. */
export const e2eEnv = (): E2eEnv => {
  const parsed = e2eEnvSchema.parse(process.env);
  const env: E2eEnv = { pm: parsed[E2E_PM_ENV], turboVersion: parsed[E2E_TURBO_VERSION_ENV] };

  return env;
};

/** Whether this run includes the cases of `pm`: always when `ATOMIZER_E2E_PM` is unset. */
export const isPmSelected = (pm: PackageManager): boolean => {
  const selected = e2eEnv().pm;

  return selected === undefined || selected === pm;
};
