import { parse } from 'jsonc-parser';

import type { AtomsDiff } from '../common/atoms-diff.type.ts';
import { atomsTurboJsonSchema } from '../common/atoms-turbo-json.schema.ts';

type SerializedTasks = Map<string, string>;

const toSerializedEntry = ([name, task]: [string, unknown]): [string, string] => {
  const serializedTask = JSON.stringify(task);

  return [name, serializedTask];
};

const readSerializedTasks = (text: string): SerializedTasks => {
  const json: unknown = parse(text);
  const result = atomsTurboJsonSchema.safeParse(json);

  if (!result.success) return new Map();

  const entries = Object.entries(result.data.tasks).map(toSerializedEntry);

  return new Map(entries);
};

export const diffAtoms = (before: string | undefined, after: string): AtomsDiff => {
  const beforeTasks = readSerializedTasks(before ?? '');
  const afterTasks = readSerializedTasks(after);
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
