import { ALL_TASK_SUFFIX } from '../../shared/atomizer/common/atomizer.const.ts';

/** A task without a `tags` array passes; one with tags must carry `atomizer:<task>` (skips helper tasks such as carriers). */
const hasTaskTag = (definition: unknown, tag: string): boolean => {
  const isObject = typeof definition === 'object' && definition !== null;

  if (!isObject || !('tags' in definition)) return true;

  const tags = definition.tags;

  if (!Array.isArray(tags)) return true;

  return tags.includes(tag);
};

/** Task paths of the generated file tasks `<task>--<path>`, without the aggregate `<task>--all`. */
export const toFileTaskPaths = (tasks: Record<string, unknown>, task: string): string[] => {
  const prefix = `${task}--`;
  const allTask = `${task}${ALL_TASK_SUFFIX}`;
  const tag = `atomizer:${task}`;
  const entries = Object.entries(tasks);

  const isFileTask = ([name, definition]: [string, unknown]): boolean => {
    const isOwnTask = name.startsWith(prefix) && name !== allTask;

    return isOwnTask && hasTaskTag(definition, tag);
  };

  return entries.filter(isFileTask).map(([name]): string => name.slice(prefix.length));
};
