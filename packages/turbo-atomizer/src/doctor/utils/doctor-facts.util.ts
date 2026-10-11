import { parse } from 'jsonc-parser';

import { ATOMIZER_TASK_TAG_PREFIX } from '../../shared/atomizer/common/atomizer.const.ts';
import type { TurboJsonDoc } from '../../shared/turbo/common/turbo-json.type.ts';
import { atomsTurboJsonSchema, taggedTaskSchema } from '../../sync/common/atoms-turbo-json.schema.ts';
import type { OutsideImport } from '../common/doctor-facts.type.ts';

const hasTag = (task: unknown, tag: string): boolean => {
  const result = taggedTaskSchema.safeParse(task);

  if (!result.success) return false;

  return result.data.tags.includes(tag);
};

/** Spec paths of the file tasks in the generated turbo.json, picked by the `atomizer:<task>` tag (spec §9), never by name. */
export const readFileTaskPaths = (text: string | undefined, task: string): string[] => {
  const json: unknown = parse(text ?? '');
  const result = atomsTurboJsonSchema.safeParse(json);

  if (!result.success) return [];

  const fileTaskTag = `${ATOMIZER_TASK_TAG_PREFIX}${task}`;
  const prefix = `${task}--`;
  const isFileTask = ([, definition]: [string, unknown]): boolean => hasTag(definition, fileTaskTag);
  const fileTaskEntries = Object.entries(result.data.tasks).filter(isFileTask);

  return fileTaskEntries.map(([name]): string => name.slice(prefix.length));
};

/** The files `spec` imports that lie outside `packageDir`; both are posix, `files` and `packageDir` relative to the workspace root. */
export const toOutsideImports = (spec: string, files: string[], packageDir: string): OutsideImport[] => {
  const isOutside = (file: string): boolean => !file.startsWith(`${packageDir}/`);
  const outsideFiles = files.filter(isOutside);

  const toOutsideImport = (file: string): OutsideImport => {
    const outsideImport: OutsideImport = { spec, file };

    return outsideImport;
  };

  return outsideFiles.map(toOutsideImport);
};

export const hasFutureFlag = (turboJson: TurboJsonDoc | undefined, flag: string): boolean => {
  return turboJson?.content.futureFlags?.[flag] === true;
};
