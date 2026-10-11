import { describe, expect, it } from 'vitest';

import { toExcludeGlobs, toIncludeGlobs } from './workspace-glob.util.ts';

describe('FEATURE: workspace glob split', (): void => {
  describe('GIVEN positive and negated globs with ./ and trailing slashes', (): void => {
    const globs = ['./apps/*/', '!./apps/legacy/', 'tools/*'];

    it('WHEN include globs are taken THEN the positive globs are returned normalized', (): void => {
      const include = toIncludeGlobs(globs);

      expect(include).toEqual(['apps/*', 'tools/*']);
    });

    it('WHEN exclude globs are taken THEN the negated globs are returned without the ! and normalized', (): void => {
      const exclude = toExcludeGlobs(globs);

      expect(exclude).toEqual(['apps/legacy']);
    });
  });
});
