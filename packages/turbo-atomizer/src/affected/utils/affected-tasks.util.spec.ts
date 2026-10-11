import { describe, expect, it } from 'vitest';

import { selectPackageTasks, toTurboRunArgs } from './affected-tasks.util.ts';

describe('FEATURE: affected tasks', (): void => {
  describe('GIVEN affected full names from the test package and its generated copy', (): void => {
    const fullNames = [
      '@acme/web-e2e#e2e-ci--tests/b.spec.ts',
      '@acme/web-e2e-atoms#e2e-ci--tests/a.spec.ts',
      '@acme/web-e2e#e2e-ci--tests/a.spec.ts',
      '@acme/web-e2e#e2e-ci--tests/b.spec.ts'
    ];

    it('WHEN selected for the scoped test package THEN its task names are stripped, deduped and sorted', (): void => {
      const names = selectPackageTasks(fullNames, '@acme/web-e2e');

      expect(names).toEqual(['e2e-ci--tests/a.spec.ts', 'e2e-ci--tests/b.spec.ts']);
    });

    it('WHEN selected for a package with no affected task THEN the list is empty', (): void => {
      const names = selectPackageTasks(fullNames, 'admin-e2e');

      expect(names).toEqual([]);
    });
  });

  describe('GIVEN no affected full names', (): void => {
    it('WHEN selected THEN the list is empty', (): void => {
      const names = selectPackageTasks([], '@acme/web-e2e');

      expect(names).toEqual([]);
    });
  });

  describe('GIVEN affected task names and forwarded args', (): void => {
    it('WHEN the turbo run args are built THEN names, filter, continue flag and forwarded args follow in order', (): void => {
      const names = ['e2e-ci--tests/a.spec.ts', 'e2e-ci--tests/b.spec.ts'];

      const args = toTurboRunArgs(names, '@acme/web-e2e', ['--concurrency=2']);

      expect(args).toEqual([
        'e2e-ci--tests/a.spec.ts',
        'e2e-ci--tests/b.spec.ts',
        '--filter=@acme/web-e2e',
        '--continue=dependencies-successful',
        '--concurrency=2'
      ]);
    });
  });
});
