import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { runCommand } from './workspace-command.spec.util.ts';
import { ALL_TASK_ID, CARRIER_TASK_PREFIX, FILE_TASK_PREFIX } from '../common/fixture-workspace.const.ts';
import type { CommandEnv, TaskHashes, TaskRun, TurboRun } from '../common/fixture-workspace.type.ts';
import { turboRunSchema } from '../common/turbo-summary.schema.ts';

type TaskCacheJson = {
  readonly status: string;
};

type TaskExecutionJson = {
  readonly startTime: number;
  readonly endTime: number;
  readonly exitCode?: number | undefined;
};

type TaskJson = {
  readonly taskId: string;
  readonly hash: string;
  readonly inputs: Record<string, string>;
  readonly cache: TaskCacheJson;
  readonly execution?: TaskExecutionJson | undefined;
};

const RUNS_DIR = join('.turbo', 'runs');

const LEAKED_INPUT = /(^|\/)(node_modules|\.atomizer|\.turbo)\//;

const executionMs = (execution: TaskExecutionJson | undefined): number | null => {
  if (execution === undefined) return null;

  return execution.endTime - execution.startTime;
};

const toTaskRun = (task: TaskJson): TaskRun => {
  const inputs = Object.keys(task.inputs);
  const exitCode = task.execution?.exitCode ?? null;
  const durationMs = executionMs(task.execution);
  const run: TaskRun = { taskId: task.taskId, hash: task.hash, cacheStatus: task.cache.status, inputs, exitCode, durationMs };

  return run;
};

const parseTasks = (text: string): TaskRun[] => {
  const raw: unknown = JSON.parse(text);
  const summary = turboRunSchema.parse(raw);

  return summary.tasks.map(toTaskRun);
};

const noFiles = (): string[] => [];

const readSummaryTasks = async (runsDir: string): Promise<TaskRun[]> => {
  const files = await readdir(runsDir).catch(noFiles);
  const [file] = files;

  if (file === undefined) return [];

  const text = await readFile(join(runsDir, file), 'utf8');

  return parseTasks(text);
};

/** Runs `command` with `--summarize` appended and reads its tasks from the run summary; no summary (turbo never ran) → no tasks. */
export const summarizedRun = async (root: string, command: string, env: CommandEnv = {}): Promise<TurboRun> => {
  const runsDir = join(root, RUNS_DIR);

  await rm(runsDir, { force: true, recursive: true });

  const result = await runCommand(root, `${command} --summarize`, env);
  const tasks = await readSummaryTasks(runsDir);
  const run: TurboRun = { result, tasks };

  return run;
};

/** The tasks `turbo run <task>` would run, with hashes and cache status, from `--dry=json`. */
export const dryRunTasks = async (root: string, task: string): Promise<TaskRun[]> => {
  const command = `turbo run ${task} --dry=json`;
  const result = await runCommand(root, command);

  if (result.exitCode !== 0) throw new Error(`\`${command}\` exited ${String(result.exitCode)}\n${result.stderr}`);

  return parseTasks(result.stdout);
};

const hashEntry = (task: TaskRun): [string, string] => [task.taskId, task.hash];

export const taskHashesOf = (tasks: TaskRun[]): TaskHashes => Object.fromEntries(tasks.map(hashEntry));

export const fileTaskId = (taskPath: string): string => `${FILE_TASK_PREFIX}${taskPath}`;

const isFileTask = (task: TaskRun): boolean => task.taskId.startsWith(FILE_TASK_PREFIX) && task.taskId !== ALL_TASK_ID;

const isAtomTaskId = (taskId: string): boolean => {
  const isFileTaskId = taskId.startsWith(FILE_TASK_PREFIX) && taskId !== ALL_TASK_ID;

  return isFileTaskId || taskId.startsWith(CARRIER_TASK_PREFIX);
};

const isMiss = (task: TaskRun): boolean => task.cacheStatus === 'MISS';

const isFailed = (task: TaskRun): boolean => task.exitCode !== null && task.exitCode !== 0;

const idOf = (task: TaskRun): string => task.taskId;

const sortedIds = (tasks: TaskRun[]): string[] => tasks.map(idOf).toSorted();

export const fileTaskIds = (tasks: TaskRun[]): string[] => sortedIds(tasks.filter(isFileTask));

/** File tasks that executed instead of replaying from cache. */
export const missedFileTaskIds = (tasks: TaskRun[]): string[] => fileTaskIds(tasks.filter(isMiss));

/** Every task, carriers and builds included, that executed instead of replaying from cache. */
export const missedTaskIds = (tasks: TaskRun[]): string[] => sortedIds(tasks.filter(isMiss));

export const failedFileTaskIds = (tasks: TaskRun[]): string[] => fileTaskIds(tasks.filter(isFailed));

export const cacheStatusOf = (tasks: TaskRun[], taskId: string): string | undefined => {
  const task = tasks.find((candidate): boolean => candidate.taskId === taskId);

  return task?.cacheStatus;
};

/** File tasks and carriers present in both maps whose hash differs. */
export const changedAtomTaskIds = (before: TaskHashes, after: TaskHashes): string[] => {
  const changed: string[] = [];

  for (const [taskId, hash] of Object.entries(after)) {
    const previous = before[taskId];
    const isChanged = previous !== undefined && previous !== hash;
    const isAtom = isAtomTaskId(taskId);

    if (isChanged && isAtom) changed.push(taskId);
  }

  return changed.toSorted();
};

const leakedInputsOf = (task: TaskRun): string[] => {
  const leaked = task.inputs.filter((input): boolean => LEAKED_INPUT.test(input));

  return leaked.map((input): string => `${task.taskId}: ${input}`);
};

/** Inputs of file tasks and carriers that git ignores: `node_modules`, `.atomizer` and `.turbo` paths. */
export const leakedInputs = (tasks: TaskRun[]): string[] => {
  const atomTasks = tasks.filter((task): boolean => isAtomTaskId(task.taskId));

  return atomTasks.flatMap(leakedInputsOf);
};
