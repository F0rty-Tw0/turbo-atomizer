import { z } from 'zod';

const argListSchema = z.array(z.string());

const parseJsonArgs = (value: string): string[] | undefined => {
  try {
    const raw: unknown = JSON.parse(value);
    const parsed = argListSchema.safeParse(raw);

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Spec §6.3: a value starting with `[` (after spaces) is a JSON array of strings, any other value splits on whitespace.
 * Unset or blank gives no args; `undefined` means the JSON form is invalid.
 */
export const parseAtomizerArgs = (value: string | undefined): string[] | undefined => {
  const trimmed = value?.trim() ?? '';

  if (trimmed === '') return [];

  const isJson = trimmed.startsWith('[');

  if (isJson) return parseJsonArgs(trimmed);

  return trimmed.split(/\s+/);
};
