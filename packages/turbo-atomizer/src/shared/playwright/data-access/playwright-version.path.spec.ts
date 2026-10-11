import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getPlaywrightVersion } from './playwright-version.path.ts';
import { fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';

describe('FEATURE: Playwright version path', (): void => {
  describe('GIVEN a test package that resolves @playwright/test', (): void => {
    it('WHEN the version is read THEN the installed version is returned', (): void => {
      const packageDir = join(fixtureDirectory('basic'), 'apps/e2e');

      const version = getPlaywrightVersion(packageDir);

      expect(version).toBe('1.64.0');
    });
  });
});
