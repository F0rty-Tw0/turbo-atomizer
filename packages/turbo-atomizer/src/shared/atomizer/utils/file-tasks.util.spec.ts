import { describe, expect, it } from 'vitest';

import { hasTaskTag, readFileTaskPaths, toFileTaskPaths } from './file-tasks.util.ts';

const fileTask = { command: ['node'], tags: ['atomizer:e2e-ci'] };

const liveFileTask = { command: ['node'], tags: ['atomizer:e2e-ci', 'atomizer:live'] };

const carrier = { command: ['node', '-e', '0'], tags: ['atomizer:carrier'] };

const allTask = { dependsOn: ['e2e-ci--tests/a.spec.ts'] };

const smokeFileTask = { tags: ['atomizer:smoke'] };

const generatedTasks = {
  'e2e-ci--tests/a.spec.ts': fileTask,
  'e2e-ci--tests/my spec.spec.ts': fileTask,
  'e2e-ci--tests/live.spec.ts': liveFileTask,
  'e2e-ci-src--tests/a.spec.ts': carrier,
  'e2e-ci--all': allTask,
  'smoke--tests/a.spec.ts': smokeFileTask
};

const generatedText = JSON.stringify({ extends: ['//'], tasks: generatedTasks });

describe('FEATURE: file tasks', (): void => {
  describe('GIVEN generated tasks with file tasks, a carrier, the aggregate and another task group', (): void => {
    it('WHEN the paths for the task are taken THEN only tasks tagged atomizer:<task> are returned, without the task prefix', (): void => {
      const paths = toFileTaskPaths(generatedTasks, 'e2e-ci');

      expect(paths).toEqual(['tests/a.spec.ts', 'tests/my spec.spec.ts', 'tests/live.spec.ts']);
    });

    it('WHEN the paths for a group without file tasks are taken THEN none is returned', (): void => {
      const paths = toFileTaskPaths(generatedTasks, 'e2e');

      expect(paths).toEqual([]);
    });
  });

  describe('GIVEN file-task-named tasks without a tags array', (): void => {
    const stringTagTask = { tags: 'atomizer:e2e-ci' };
    const tasks = { 'e2e-ci--tests/b.spec.ts': {}, 'e2e-ci--tests/c.spec.ts': stringTagTask };

    it('WHEN the paths are taken THEN they are skipped, since selection is by tag only', (): void => {
      const paths = toFileTaskPaths(tasks, 'e2e-ci');

      expect(paths).toEqual([]);
    });
  });

  describe('GIVEN no tasks', (): void => {
    it('WHEN the paths are taken THEN none is returned', (): void => {
      const paths = toFileTaskPaths({}, 'e2e-ci');

      expect(paths).toEqual([]);
    });
  });

  describe('GIVEN the text of a generated turbo.json', (): void => {
    it('WHEN the file task paths are read THEN the tagged file task paths are returned', (): void => {
      const paths = readFileTaskPaths(generatedText, 'e2e-ci');

      expect(paths).toEqual(['tests/a.spec.ts', 'tests/my spec.spec.ts', 'tests/live.spec.ts']);
    });
  });

  describe('GIVEN no readable generated turbo.json', (): void => {
    it('WHEN the file is missing THEN no paths are returned', (): void => {
      const paths = readFileTaskPaths(undefined, 'e2e-ci');

      expect(paths).toEqual([]);
    });

    it('WHEN it has no tasks object THEN no paths are returned', (): void => {
      const paths = readFileTaskPaths('{ "extends": ["//"] }', 'e2e-ci');

      expect(paths).toEqual([]);
    });
  });

  describe('GIVEN a task definition', (): void => {
    it('WHEN its tags hold the tag THEN it matches', (): void => {
      const isTagged = hasTaskTag(liveFileTask, 'atomizer:live');

      expect(isTagged).toBe(true);
    });

    it('WHEN its tags lack the tag THEN it does not match', (): void => {
      const isTagged = hasTaskTag(carrier, 'atomizer:e2e-ci');

      expect(isTagged).toBe(false);
    });

    it('WHEN it has no tags array THEN it does not match', (): void => {
      const isTagged = hasTaskTag(allTask, 'atomizer:e2e-ci');

      expect(isTagged).toBe(false);
    });
  });
});
