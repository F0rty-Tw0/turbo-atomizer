export const TURBO_MIN_VERSION = '2.11.7';

/** First turbo version outside the tested range `>=2.11.7 <2.12.0`. */
export const TURBO_UNTESTED_VERSION = '2.12.0';

export const PLAYWRIGHT_MIN_VERSION = '1.56.0';

export const PNPM_LOCKFILE = 'pnpm-lock.yaml';

export const NPM_LOCKFILE = 'package-lock.json';

/** Lockfiles of package managers turbo-atomizer does not support, named in the init error. */
export const UNSUPPORTED_LOCKFILES = ['yarn.lock', 'bun.lock', 'bun.lockb'];

export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';
