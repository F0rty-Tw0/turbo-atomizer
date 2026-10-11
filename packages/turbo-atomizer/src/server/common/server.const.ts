import type { ServerMessage, SupervisorState } from './server-protocol.type.ts';
import type { GracefulShutdown } from './server.type.ts';

export const PROBE_BACKOFF_MS: number[] = [100, 250, 500];

export const PROBE_STEADY_MS = 1000;

export const STARTING_MESSAGE: ServerMessage = { state: 'starting' };

export const INITIAL_SUPERVISOR_STATE: SupervisorState = { phase: 'starting', leases: 0, message: STARTING_MESSAGE };

/** Playwright's defaults for a webServer process (`runner/index.js` DEFAULT_ENVIRONMENT_VARIABLES). */
export const SERVER_DEFAULT_ENV: Record<string, string> = { BROWSER: 'none', ['DEBUG_COLORS']: '1', ['FORCE_COLOR']: '1' };

export const DEFAULT_SERVER_TIMEOUT_MS = 60_000;

export const DEFAULT_GRACEFUL_SHUTDOWN: GracefulShutdown = { signal: 'SIGTERM', timeout: 5000 };

export const LOG_TAIL_LINES = 50;

export const STARTING_INTERVAL_MS = 5000;

export const CLIENT_SILENCE_MS = 30_000;

export const SUPERVISOR_CONNECT_MS = 10_000;

export const SUPERVISOR_RESPAWN_MS = 2000;

export const SUPERVISOR_SPAWNS = 3;

export const LEASE_ATTEMPTS = 3;

export const PROBE_REQUEST_TIMEOUT_MS = 5000;

export const MAX_PROBE_REDIRECTS = 10;

export const SERVER_LOG_FILE = 'server.log';

export const PIPE_TOKEN_FILE = 'turbo-atomizer-pipe.token';

export const PIPE_TOKEN_BYTES = 16;

export const PIPE_TOKEN_PATTERN = /^[0-9a-f]{32}$/;
