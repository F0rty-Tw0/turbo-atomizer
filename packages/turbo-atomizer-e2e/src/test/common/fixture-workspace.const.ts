import type { CommandEnv, PackageManager } from './fixture-workspace.type.ts';

export const ATOMIZER_PACKAGE = 'turbo-atomizer';

export const TEST_PACKAGE_DIR = 'apps/web-e2e';

export const ATOMS_TURBO_JSON = 'tools/web-e2e-atoms/turbo.json';

export const FILE_TASK_PREFIX = 'web-e2e#e2e-ci--';

export const CARRIER_TASK_PREFIX = 'web-e2e#e2e-ci-src--';

export const ALL_TASK_ID = 'web-e2e#e2e-ci--all';

/** The pnpm-basic specs, as task paths relative to the test package, sorted. */
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

/** Fails the pnpm-basic profile spec when `1`; the fixture passes it through unhashed (`globalPassThroughEnv`). */
export const FAIL_TOGGLE_ENV = 'ATOMIZER_E2E_FAIL';

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
