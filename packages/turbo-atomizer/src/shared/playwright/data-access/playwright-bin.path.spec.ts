import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolvePlaywrightBin } from './playwright-bin.path.ts';
import { fixtureDirectory } from '../../../test/utils/fixture-copy.spec.util.ts';

describe('FEATURE: Playwright bin path', (): void => {
  describe('GIVEN a test package that resolves @playwright/test', (): void => {
    it('WHEN the bin is resolved THEN it points at an existing file', (): void => {
      const packageDir = join(fixtureDirectory('basic'), 'apps/e2e');

      const bin = resolvePlaywrightBin(packageDir);

      expect(existsSync(bin)).toBe(true);
    });
  });
});
