import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { applyEdits, modify, parse, printParseErrorCode } from 'jsonc-parser';
import type { FormattingOptions, ParseError } from 'jsonc-parser';

import { TurboJsonInvalidException } from '../common/turbo-json-invalid.exception.ts';
import { turboJsonSchema } from '../common/turbo-json.schema.ts';
import type { JsonEdit, TurboJsonDoc } from '../common/turbo-json.type.ts';
import { TURBO_JSON_FILES } from '../common/turbo.const.ts';

const formattingOptions: FormattingOptions = { eol: '\n', insertSpaces: true, tabSize: 2 };

const EMPTY_TURBO_JSON = '{}\n';

const describeParseError = (error: ParseError): string => `${printParseErrorCode(error.error)} at offset ${String(error.offset)}`;

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
};

const readOrEmpty = async (path: string | undefined): Promise<string> => {
  if (path === undefined) return EMPTY_TURBO_JSON;

  return readFile(path, 'utf8');
};

/** Returns the path of `turbo.json` or `turbo.jsonc` in `directory`, or `undefined` when neither exists. */
const findTurboJsonPath = async (directory: string): Promise<string | undefined> => {
  const candidates = TURBO_JSON_FILES.map((name): string => join(directory, name));
  const exists = await Promise.all(candidates.map(pathExists));

  return candidates[exists.indexOf(true)];
};

/** Reads `turbo.json` or `turbo.jsonc` in `directory` as JSONC; `undefined` when neither exists. */
export const readTurboJson = async (directory: string): Promise<TurboJsonDoc | undefined> => {
  const path = await findTurboJsonPath(directory);

  if (path === undefined) return undefined;

  const text = await readFile(path, 'utf8');
  const errors: ParseError[] = [];
  const raw: unknown = parse(text, errors, { allowTrailingComma: true });
  const details = errors.map(describeParseError).join('\n');

  if (errors.length > 0) throw new TurboJsonInvalidException(path, details);

  const parsed = turboJsonSchema.safeParse(raw);

  if (!parsed.success) throw new TurboJsonInvalidException(path, parsed.error.message);

  const doc: TurboJsonDoc = { content: parsed.data, path };

  return doc;
};

/**
 * Applies `edits` to `turbo.json` or `turbo.jsonc` in `directory`, keeping comments and formatting.
 * Creates `turbo.json` when neither exists. Returns whether the bytes changed.
 */
export const editTurboJson = async (directory: string, edits: JsonEdit[]): Promise<boolean> => {
  const existingPath = await findTurboJsonPath(directory);
  const path = existingPath ?? join(directory, 'turbo.json');
  const original = await readOrEmpty(existingPath);
  let text = original;

  for (const edit of edits) {
    const textEdits = modify(text, edit.path, edit.value, { formattingOptions });

    text = applyEdits(text, textEdits);
  }

  if (text === original) return false;

  await writeFile(path, text);

  return true;
};
