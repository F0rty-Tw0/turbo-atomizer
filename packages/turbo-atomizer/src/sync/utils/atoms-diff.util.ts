import { parse } from 'jsonc-parser';

import { ATOMIZER_TASK_TAG_PREFIX } from '../../shared/atomizer/common/atomizer.const.ts';
import { atomsTurboJsonSchema } from '../../shared/atomizer/common/atoms-turbo-json.schema.ts';
import { hasTaskTag } from '../../shared/atomizer/utils/file-tasks.util.ts';
import type { AtomsDiff } from '../common/atoms-diff.type.ts';

type SerializedTasks = Map<string, string>;

const toSerializedEntry = ([name, task]: [string, unknown]): [string, string] => {
  const serializedTask = JSON.stringify(task);

  return [name, serializedTask];
};

const readSerializedFileTasks = (text: string, fileTaskTag: string): SerializedTasks => {
  const json: unknown = parse(text);
  const result = atomsTurboJsonSchema.safeParse(json);

  if (!result.success) return new Map();

  const isFileTask = ([, task]: [string, unknown]): boolean => hasTaskTag(task, fileTaskTag);
  const fileTaskEntries = Object.entries(result.data.tasks).filter(isFileTask);
  const entries = fileTaskEntries.map(toSerializedEntry);

  return new Map(entries);
};

/** File tasks only, picked by the `atomizer:<task>` tag; a carrier changes only together with its file task (spec §6.2). */
export const diffAtoms = (before: string | undefined, after: string, task: string): AtomsDiff => {
  const fileTaskTag = `${ATOMIZER_TASK_TAG_PREFIX}${task}`;
  const beforeTasks = readSerializedFileTasks(before ?? '', fileTaskTag);
  const afterTasks = readSerializedFileTasks(after, fileTaskTag);
  const afterNames = Array.from(afterTasks.keys());
  const beforeNames = Array.from(beforeTasks.keys());
  const isAdded = (name: string): boolean => !beforeTasks.has(name);
  const isRemoved = (name: string): boolean => !afterTasks.has(name);
  const isChanged = (name: string): boolean => beforeTasks.has(name) && beforeTasks.get(name) !== afterTasks.get(name);
  const added = afterNames.filter(isAdded);
  const removed = beforeNames.filter(isRemoved);
  const changed = afterNames.filter(isChanged);
  const diff: AtomsDiff = { added, removed, changed };

  return diff;
};
