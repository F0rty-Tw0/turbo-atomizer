import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getTurboVersion } from './turbo-version.path.ts';

describe('FEATURE: turbo version path', (): void => {
  describe('GIVEN the turbo-atomizer package, where pnpm links its turbo devDependency', (): void => {
    it('WHEN the version is read THEN the installed version is returned', async (): Promise<void> => {
      const packageDir = join(import.meta.dirname, '../../../..');

      const version = await getTurboVersion(packageDir);

      expect(version).toBe('2.11.7');
    });
  });
});
