import type { WaitPattern } from '../common/server-protocol.type.ts';

/** Captures named groups as env entries; keys are upper-cased like Playwright's `process.env[key.toUpperCase()]`. */
export const matchWaitPattern = (pattern: WaitPattern, output: string): Record<string, string> | undefined => {
  const regex = new RegExp(pattern.source, pattern.flags);
  const match = regex.exec(output);

  if (match === null) return undefined;

  // lib.es2018 types group values as string, but a group outside the match is undefined at runtime
  const groups: Record<string, string | undefined> = match.groups ?? {};
  const captured: Record<string, string> = {};

  for (const [name, value] of Object.entries(groups)) {
    if (value !== undefined) captured[name.toUpperCase()] = value;
  }

  return captured;
};
