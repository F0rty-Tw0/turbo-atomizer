import { fileTaskIds } from './turbo-summary.spec.util.ts';
import type { TaskRun, TurboRun } from '../common/fixture-workspace.type.ts';

const durationOf = (task: TaskRun): number => task.durationMs ?? 0;

const meanFileTaskMs = (tasks: TaskRun[]): number => {
  const ids = new Set(fileTaskIds(tasks));
  const fileTasks = tasks.filter((task): boolean => ids.has(task.taskId));
  const total = fileTasks.map(durationOf).reduce((sum, ms): number => sum + ms, 0);

  if (fileTasks.length === 0) return 0;

  return Math.round(total / fileTasks.length);
};

const describeRun = (label: string, run: TurboRun): string => {
  const count = fileTaskIds(run.tasks).length;
  const mean = meanFileTaskMs(run.tasks);

  return `${label}: ${String(count)} file tasks, run ${String(run.result.durationMs)} ms, mean ${String(mean)} ms per file task`;
};

/** One report line per run: file task count, wall time of the whole `turbo run`, mean task duration from the run summary. */
export const startupCostReport = (cold: TurboRun, cached: TurboRun): string => {
  const coldLine = describeRun('startup-cost cold', cold);
  const cachedLine = describeRun('startup-cost cached', cached);

  return `${coldLine}\n${cachedLine}\n`;
};
