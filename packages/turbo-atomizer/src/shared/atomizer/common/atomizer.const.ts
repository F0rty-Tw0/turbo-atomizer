export const ATOMIZER_CONFIG_FILE = 'turbo-atomizer.json';

export const ATOMIZER_PACKAGE_JSON_KEY = 'turbo-atomizer';

export const ATOMIZER_METADATA_KEY = 'turbo-atomizer';

export const ATOMIZER_METADATA_VERSION = 1;

export const TURBO_ATOMIZER_ENV = 'TURBO_ATOMIZER';

export const TURBO_ATOMIZER_DESCRIBE_ENV = 'TURBO_ATOMIZER_DESCRIBE';

export const TURBO_ATOMIZER_SERVER_ENV_ENV = 'TURBO_ATOMIZER_SERVER_ENV';

export const TURBO_ATOMIZER_COUNT_FILE_ENV = 'TURBO_ATOMIZER_COUNT_FILE';

/** Extra Playwright args for every file task; listed in each file task's hashed `env` (spec §6.3). */
export const TURBO_ATOMIZER_ARGS_ENV = 'TURBO_ATOMIZER_ARGS';

export const DEFAULT_TASK = 'e2e-ci';

/** Per-package output dir; each file task writes to `.atomizer/<slug>/`. */
export const ATOMIZER_OUTPUT_DIR = '.atomizer';

export const DEFAULT_SPEC_GLOBS = ['**/*.{spec,test}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'];

export const DEFAULT_SNAPSHOT_GLOBS = ['**/*-snapshots/**'];

export const DEFAULT_DEPENDS_ON = ['^build'];

export const DEFAULT_SERVER_IDLE_MS = 5000;

export const DEFAULT_PLAYWRIGHT_CONFIG = 'playwright.config.ts';

export const PLAYWRIGHT_CONFIG_FILES = [
  'playwright.config.ts',
  'playwright.config.js',
  'playwright.config.mts',
  'playwright.config.mjs',
  'playwright.config.cts',
  'playwright.config.cjs'
];

/** Suffix of the aggregate task: `<task>--all`. */
export const ALL_TASK_SUFFIX = '--all';

/** Tag on the generated package's turbo.json; part of the Console contract. */
export const ATOMIZER_DEFINITIONS_TAG = 'atomizer:definitions';

/** Tag on every carrier task; part of the Console contract (spec §9). */
export const ATOMIZER_CARRIER_TAG = 'atomizer:carrier';

/** Tag on live (uncached-pattern) file tasks; part of the Console contract. */
export const ATOMIZER_LIVE_TAG = 'atomizer:live';

/** Prefix of the per-group file-task tag `atomizer:<task>`; part of the Console contract (spec §9). */
export const ATOMIZER_TASK_TAG_PREFIX = 'atomizer:';

/** exec flag: add a blob reporter because the config has none (spec §6.2 step 5). */
export const ATOMIZER_BLOB_FLAG = '--atomizer-blob';

/** Carrier task name infix: `<task>-src--<task path>`; file tasks always start `<task>--` (spec §4). */
export const CARRIER_TASK_INFIX = '-src--';
