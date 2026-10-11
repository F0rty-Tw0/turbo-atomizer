import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { packageFileExists } from './package-file.store.ts';
import { fixtureDirectory } from '../../test/utils/fixture-copy.spec.util.ts';

const packageDir = join(fixtureDirectory('basic'), 'apps/e2e');

describe('FEATURE: package file store', (): void => {
  describe('GIVEN the basic fixture package', (): void => {
    it('WHEN an existing spec is checked THEN it exists', (): void => {
      const exists = packageFileExists(packageDir, 'tests/nested/c.spec.ts');

      expect(exists).toBe(true);
    });

    it('WHEN a missing spec is checked THEN it does not exist', (): void => {
      const exists = packageFileExists(packageDir, 'tests/gone.spec.ts');

      expect(exists).toBe(false);
    });
  });
});
