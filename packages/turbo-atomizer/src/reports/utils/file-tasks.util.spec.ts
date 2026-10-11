import { describe, expect, it } from 'vitest';

import { toFileTaskPaths } from './file-tasks.util.ts';

const fileTaskTags = ['atomizer:e2e-ci'];
const liveTaskTags = ['atomizer:e2e-ci', 'atomizer:live'];
const carrierTags = ['atomizer:carrier'];

describe('FEATURE: file task paths', (): void => {
  describe('GIVEN generated tasks with file tasks, the aggregate and an unrelated task', (): void => {
    const allTask = { dependsOn: ['e2e-ci--tests/a.spec.ts'] };
    const tasks = {
      'e2e-ci--tests/a.spec.ts': {},
      'e2e-ci--tests/my spec.spec.ts': {},
      'e2e-ci--all': allTask,
      'smoke--tests/a.spec.ts': {}
    };

    it('WHEN the paths for the task are taken THEN only its file task paths are returned', (): void => {
      const paths = toFileTaskPaths(tasks, 'e2e-ci');

      expect(paths).toEqual(['tests/a.spec.ts', 'tests/my spec.spec.ts']);
    });
  });

  describe('GIVEN file tasks that carry tags', (): void => {
    const fileTask = { tags: fileTaskTags };
    const liveTask = { tags: liveTaskTags };
    const carrierTask = { tags: carrierTags };
    const stringTagTask = { tags: 'atomizer:e2e-ci' };
    const tasks = {
      'e2e-ci--tests/a.spec.ts': fileTask,
      'e2e-ci--tests/b.spec.ts': liveTask,
      'e2e-ci--carrier': carrierTask,
      'e2e-ci--tests/c.spec.ts': stringTagTask
    };

    it('WHEN the paths are taken THEN a task whose tags lack atomizer:<task> is skipped and one without a tags array is kept', (): void => {
      const paths = toFileTaskPaths(tasks, 'e2e-ci');

      expect(paths).toEqual(['tests/a.spec.ts', 'tests/b.spec.ts', 'tests/c.spec.ts']);
    });
  });

  describe('GIVEN no tasks', (): void => {
    it('WHEN the paths are taken THEN none is returned', (): void => {
      const paths = toFileTaskPaths({}, 'e2e-ci');

      expect(paths).toEqual([]);
    });
  });
});
