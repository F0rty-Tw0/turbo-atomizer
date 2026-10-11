import type { CommandEnv, FixtureName, PackageManager } from './fixture-workspace.type.ts';

/** Fixtures that only hold the files that differ from their base fixture; the harness copies the base first. */
export const FIXTURE_BASES: Partial<Record<FixtureName, FixtureName>> = { 'npm-basic': 'pnpm-basic' };

export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';

export const TEST_PACKAGE_DIR = 'apps/web-e2e';

export const ATOMS_TURBO_JSON = 'tools/web-e2e-atoms/turbo.json';

export const FILE_TASK_PREFIX = 'web-e2e#e2e-ci--';

export const CARRIER_TASK_PREFIX = 'web-e2e#e2e-ci-src--';

export const ALL_TASK_ID = 'web-e2e#e2e-ci--all';

/** The pnpm-basic and npm-basic specs, as task paths relative to the test package, sorted. */
export const PNPM_BASIC_SPECS = [
  'tests/cart.spec.ts',
  'tests/checkout.spec.ts',
  'tests/home.spec.ts',
  'tests/login.spec.ts',
  'tests/profile.spec.ts',
  'tests/search.spec.ts'
];

/** Placeholder the harness replaces in every fixture file with a free port; `<n>` numbers the ports of one fixture. */
export const PORT_PLACEHOLDER = /__ATOMIZER_E2E_PORT_(\d+)__/g;

export const MAX_FIXTURE_PORTS = 2;

export const INSTALL_COMMANDS: Record<PackageManager, string> = {
  npm: 'npm install --prefer-offline --no-audit --no-fund',
  pnpm: 'pnpm install --prefer-offline'
};

export const TURBO_ATOMIZER_ARGS_ENV = 'TURBO_ATOMIZER_ARGS';

export const TURBO_SCM_BASE_ENV = 'TURBO_SCM_BASE';

/** Runs only the cases of one package manager (`npm` or `pnpm`); unset runs both. The CI matrix sets it per leg. */
export const E2E_PM_ENV = 'ATOMIZER_E2E_PM';

/** A turbo version or dist-tag that replaces every fixture's pinned turbo; the non-blocking `turbo@latest` CI job sets it. */
export const E2E_TURBO_VERSION_ENV = 'ATOMIZER_E2E_TURBO_VERSION';

/** Set for one run, makes every pnpm-basic test hold open for 120 s; turbo passes it through without hashing it. */
export const E2E_HANG_ENV = 'ATOMIZER_E2E_HANG';

const GIT_IDENTITY = 'turbo-atomizer-e2e';

const GIT_EMAIL = 'e2e@turbo-atomizer.invalid';

/** Git identity and settings for the fixture repo, so no user config (signing, hooks) applies. */
export const GIT_ENV: CommandEnv = Object.fromEntries([
  ['GIT_AUTHOR_EMAIL', GIT_EMAIL],
  ['GIT_AUTHOR_NAME', GIT_IDENTITY],
  ['GIT_COMMITTER_EMAIL', GIT_EMAIL],
  ['GIT_COMMITTER_NAME', GIT_IDENTITY],
  ['GIT_CONFIG_COUNT', '2'],
  ['GIT_CONFIG_KEY_0', 'commit.gpgsign'],
  ['GIT_CONFIG_VALUE_0', 'false'],
  ['GIT_CONFIG_KEY_1', 'core.hooksPath'],
  ['GIT_CONFIG_VALUE_1', '/dev/null']
]);

export const QUIET_ENV: CommandEnv = Object.fromEntries([
  ['DO_NOT_TRACK', '1'],
  ['NO_COLOR', '1'],
  ['TURBO_TELEMETRY_DISABLED', '1']
]);

/** How long dispose waits for the supervisor to stop its servers and exit (idle 5 s plus graceful shutdown). */
export const PROCESS_SETTLE_MS = 20_000;
