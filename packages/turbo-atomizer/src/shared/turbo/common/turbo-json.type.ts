import type { JSONPath } from 'jsonc-parser';

export type TurboJsonContent = {
  readonly extends?: string[] | undefined;
  readonly futureFlags?: Record<string, unknown> | undefined;
  readonly tasks?: Record<string, unknown> | undefined;
};

export type TurboJsonDoc = {
  readonly content: TurboJsonContent;
  readonly path: string;
};

/** One `jsonc-parser` `modify`: sets `value` at `path`; `undefined` removes the key. */
export type JsonEdit = {
  readonly path: JSONPath;
  readonly value: unknown;
};
