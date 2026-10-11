import { z } from 'zod';

import { ALL_TASK_SUFFIX } from '../../shared/atomizer/common/atomizer.const.ts';
import type { JsonEdit, TurboJsonContent, TurboJsonDoc } from '../../shared/turbo/common/turbo-json.type.ts';
import type { TurboJsonPlan } from '../common/init.type.ts';

type UmbrellaTask = {
  readonly dependsOn: string[];
};

const dependsOnField = z.array(z.string()).optional();

const umbrellaTaskSchema = z.looseObject({ dependsOn: dependsOnField });

const conflict = (message: string): TurboJsonPlan => {
  const plan: TurboJsonPlan = { kind: 'conflict', message };

  return plan;
};

const dependsOnAll = (task: unknown, allTask: string): boolean => {
  const parsed = umbrellaTaskSchema.safeParse(task);

  if (!parsed.success) return false;

  const dependsOn = parsed.data.dependsOn ?? [];

  return dependsOn.includes(allTask);
};

const pendingEdits = (content: TurboJsonContent, generatedName: string, task: string, umbrellaTask: UmbrellaTask): JsonEdit[] => {
  const extendsList = content.extends ?? ['//'];
  const hasGeneratedName = extendsList.includes(generatedName);
  const hasTask = content.tasks?.[task] !== undefined;
  const extendsEdit: JsonEdit = { path: ['extends'], value: [...extendsList, generatedName] };
  const taskEdit: JsonEdit = { path: ['tasks', task], value: umbrellaTask };
  const edits: JsonEdit[] = [];

  if (!hasGeneratedName) edits.push(extendsEdit);

  if (!hasTask) edits.push(taskEdit);

  return edits;
};

/** Decides init step 8 for the test package's turbo.json; never overwrites user content. */
export const planTestTurboJson = (
  existing: TurboJsonDoc | undefined,
  generatedName: string,
  task: string,
  hasScript: boolean
): TurboJsonPlan => {
  const allTask = `${task}${ALL_TASK_SUFFIX}`;
  const umbrellaTask: UmbrellaTask = { dependsOn: [allTask] };

  if (hasScript) {
    const message = `The test package's package.json has a script named "${task}"; turbo would run it after the file tasks. Remove or rename the script.`;

    return conflict(message);
  }

  if (existing === undefined) {
    const tasks = { [task]: umbrellaTask };
    const content: TurboJsonContent = { extends: ['//', generatedName], tasks };
    const created: TurboJsonPlan = { kind: 'create', content };

    return created;
  }

  const currentTask = existing.content.tasks?.[task];
  const isUmbrellaTask = dependsOnAll(currentTask, allTask);
  const isForeignTask = currentTask !== undefined && !isUmbrellaTask;

  if (isForeignTask) {
    const message = `${existing.path} defines task "${task}" without depending on "${allTask}"; change it to "${task}": { "dependsOn": ["${allTask}"] }.`;

    return conflict(message);
  }

  const edits = pendingEdits(existing.content, generatedName, task, umbrellaTask);

  if (edits.length === 0) {
    const unchanged: TurboJsonPlan = { kind: 'unchanged' };

    return unchanged;
  }

  const edited: TurboJsonPlan = { kind: 'edit', edits };

  return edited;
};
