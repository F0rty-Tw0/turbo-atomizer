import { ALL_TASK_SUFFIX, ATOMIZER_DEFINITIONS_TAG } from '../../shared/atomizer/common/atomizer.const.ts';
import type { AtomTask, TurboTask, TurboTaskDefinition } from '../common/atom-task.type.ts';

type RenderedValue = boolean | string[] | undefined;

type RenderedEntry = [string, RenderedValue];

type RenderedTask = Record<string, RenderedValue>;

type AtomsTurboJson = {
  readonly extends: string[];
  readonly tags: string[];
  readonly tasks: Record<string, RenderedTask>;
};

const isEmitted = ([, value]: RenderedEntry): boolean => {
  if (Array.isArray(value)) return value.length > 0;

  return value === false;
};

const renderTask = (definition: TurboTaskDefinition): RenderedTask => {
  const entries: RenderedEntry[] = [
    ['command', definition.command],
    ['dependsOn', definition.dependsOn],
    ['inputs', definition.inputs],
    ['outputs', definition.outputs],
    ['env', definition.env],
    ['passThroughEnv', definition.passThroughEnv],
    ['cache', definition.cache],
    ['tags', definition.tags]
  ];
  const emitted = entries.filter(isEmitted);

  return Object.fromEntries(emitted);
};

const byName = (left: TurboTask, right: TurboTask): number => {
  if (left.name < right.name) return -1;

  if (left.name > right.name) return 1;

  return 0;
};

const toRenderedEntry = (task: TurboTask): [string, RenderedTask] => [task.name, renderTask(task.definition)];

const fileTaskOf = (atomTask: AtomTask): TurboTask => atomTask.file;

const carrierOf = (atomTask: AtomTask): TurboTask => atomTask.carrier;

const nameOf = (task: TurboTask): string => task.name;

/** The generated package's turbo.json, byte-identical for identical input: tasks in code-unit order, then `<task>--all` (spec §4). */
export const renderAtomsTurboJson = (tasks: AtomTask[], task: string): string => {
  const fileTasks = tasks.map(fileTaskOf).toSorted(byName);
  const carriers = tasks.map(carrierOf);
  const generatedTasks = [...fileTasks, ...carriers];
  const sortedTasks = generatedTasks.toSorted(byName);
  const allDefinition: TurboTaskDefinition = { dependsOn: fileTasks.map(nameOf) };
  const allTask: TurboTask = { definition: allDefinition, name: `${task}${ALL_TASK_SUFFIX}` };
  const renderedTasks = [...sortedTasks, allTask];
  const entries = renderedTasks.map(toRenderedEntry);
  const json: AtomsTurboJson = {
    extends: ['//'],
    tags: [ATOMIZER_DEFINITIONS_TAG],
    tasks: Object.fromEntries(entries)
  };

  return `${JSON.stringify(json, null, 2)}\n`;
};
