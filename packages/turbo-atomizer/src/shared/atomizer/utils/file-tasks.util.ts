import { parse } from 'jsonc-parser';

import { ATOMIZER_TASK_TAG_PREFIX } from '../common/atomizer.const.ts';
import { atomsTurboJsonSchema, taggedTaskSchema } from '../common/atoms-turbo-json.schema.ts';

/** True when `definition` has a `tags` array holding `tag`; a task without one never matches. */
export const hasTaskTag = (definition: unknown, tag: string): boolean => {
  const result = taggedTaskSchema.safeParse(definition);

  if (!result.success) return false;

  return result.data.tags.includes(tag);
};

/** Spec paths of the generated file tasks `<task>--<path>`, picked by the `atomizer:<task>` tag (spec §9), never by name. */
export const toFileTaskPaths = (tasks: Record<string, unknown>, task: string): string[] => {
  const fileTaskTag = `${ATOMIZER_TASK_TAG_PREFIX}${task}`;
  const prefix = `${task}--`;
  const isFileTask = ([, definition]: [string, unknown]): boolean => hasTaskTag(definition, fileTaskTag);
  const fileTaskEntries = Object.entries(tasks).filter(isFileTask);

  return fileTaskEntries.map(([name]): string => name.slice(prefix.length));
};

/** `toFileTaskPaths` over the text of a generated turbo.json; a missing or unreadable file has none. */
export const readFileTaskPaths = (text: string | undefined, task: string): string[] => {
  const json: unknown = parse(text ?? '');
  const result = atomsTurboJsonSchema.safeParse(json);

  if (!result.success) return [];

  return toFileTaskPaths(result.data.tasks, task);
};
