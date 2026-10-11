import { describe, expect, it } from 'vitest';

import { hasFutureFlag, readFileTaskPaths, toOutsideImports } from './doctor-facts.util.ts';
import type { TurboJsonDoc } from '../../shared/turbo/common/turbo-json.type.ts';

const fileTask = { command: ['node'], tags: ['atomizer:e2e-ci'] };

const liveFileTask = { command: ['node'], tags: ['atomizer:e2e-ci', 'atomizer:live'] };

const carrier = { command: ['node', '-e', '0'], tags: ['atomizer:carrier'] };

const allTask = { dependsOn: ['e2e-ci--tests/a.spec.ts'] };

const generatedTasks = {
  'e2e-ci--tests/a.spec.ts': fileTask,
  'e2e-ci--tests/live.spec.ts': liveFileTask,
  'e2e-ci-src--tests/a.spec.ts': carrier,
  'e2e-ci--all': allTask
};

const generatedText = JSON.stringify({ extends: ['//'], tasks: generatedTasks });

const rootTurboJson = (futureFlags: Record<string, unknown> | undefined): TurboJsonDoc => {
  const content = { futureFlags };
  const doc: TurboJsonDoc = { path: '/repo/turbo.json', content };

  return doc;
};

describe('FEATURE: doctor facts helpers', (): void => {
  describe('GIVEN a generated turbo.json', (): void => {
    it('WHEN file task paths are read THEN only tasks tagged atomizer:<task> are returned, without the task prefix', (): void => {
      const paths = readFileTaskPaths(generatedText, 'e2e-ci');

      expect(paths).toEqual(['tests/a.spec.ts', 'tests/live.spec.ts']);
    });

    it('WHEN another task group is read THEN no paths are returned', (): void => {
      const paths = readFileTaskPaths(generatedText, 'e2e');

      expect(paths).toEqual([]);
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

  describe('GIVEN the files a spec imports', (): void => {
    it('WHEN they are split THEN only files outside the package dir are outside imports', (): void => {
      const files = ['apps/web-e2e/helpers/h.ts', 'shared/x.ts', 'apps/web-e2e-shared/y.ts'];

      const outsideImports = toOutsideImports('tests/a.spec.ts', files, 'apps/web-e2e');

      expect(outsideImports).toEqual([
        { spec: 'tests/a.spec.ts', file: 'shared/x.ts' },
        { spec: 'tests/a.spec.ts', file: 'apps/web-e2e-shared/y.ts' }
      ]);
    });
  });

  describe('GIVEN a root turbo.json', (): void => {
    it('WHEN the flag is true THEN it is set', (): void => {
      const isSet = hasFutureFlag(rootTurboJson({ experimentalTaskCommand: true }), 'experimentalTaskCommand');

      expect(isSet).toBe(true);
    });

    it('WHEN the flag is false THEN it is not set', (): void => {
      const isSet = hasFutureFlag(rootTurboJson({ experimentalTaskCommand: false }), 'experimentalTaskCommand');

      expect(isSet).toBe(false);
    });

    it('WHEN there are no future flags THEN it is not set', (): void => {
      const isSet = hasFutureFlag(rootTurboJson(undefined), 'experimentalTaskCommand');

      expect(isSet).toBe(false);
    });
  });

  describe('GIVEN no root turbo.json', (): void => {
    it('WHEN a flag is read THEN it is not set', (): void => {
      const isSet = hasFutureFlag(undefined, 'experimentalTaskCommand');

      expect(isSet).toBe(false);
    });
  });
});
