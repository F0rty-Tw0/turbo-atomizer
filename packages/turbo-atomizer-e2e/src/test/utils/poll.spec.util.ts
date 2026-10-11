import { setTimeout as sleep } from 'node:timers/promises';

const POLL_MS = 250;

/** Calls `check` until it returns a value other than undefined, and throws naming `label` once `timeoutMs` has passed. */
export const pollUntil = async <T>(check: () => Promise<T | undefined>, timeoutMs: number, label: string): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  let found = await check();
  let remainingMs = timeoutMs;

  while (found === undefined && remainingMs > 0) {
    await sleep(POLL_MS);
    found = await check();
    remainingMs = deadline - Date.now();
  }

  if (found === undefined) throw new Error(`timed out after ${String(timeoutMs)} ms waiting for ${label}`);

  return found;
};
