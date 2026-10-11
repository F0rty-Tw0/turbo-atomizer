import { PROBE_BACKOFF_MS, PROBE_STEADY_MS } from '../common/server.const.ts';

export const nextProbeDelay = (attempt: number): number => {
  return PROBE_BACKOFF_MS[attempt] ?? PROBE_STEADY_MS;
};
