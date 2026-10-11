import type { z } from 'zod';

/** One newline-delimited JSON line checked against `schema`; undefined for invalid JSON or a schema mismatch. */
export const parseJsonLine = <T>(line: string, schema: z.ZodType<T>): T | undefined => {
  try {
    const raw: unknown = JSON.parse(line);
    const parsed = schema.safeParse(raw);

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};
