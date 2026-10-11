import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { resolveTurboBin } from './turbo-bin.path.ts';
import { turboFixtureDir } from '../test/utils/turbo-fixture.spec.util.ts';

describe('FEATURE: turbo bin path', (): void => {
  describe('GIVEN a workspace root that resolves turbo', (): void => {
    it('WHEN the bin is resolved THEN it points at an existing file', (): void => {
      const bin = resolveTurboBin(turboFixtureDir('query-workspace'));

      expect(existsSync(bin)).toBe(true);
    });
  });
});
