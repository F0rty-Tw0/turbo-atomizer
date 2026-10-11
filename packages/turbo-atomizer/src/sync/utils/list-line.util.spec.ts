import { describe, expect, it } from 'vitest';

import { toListLine } from './list-line.util.ts';

describe('FEATURE: list line', () => {
  describe('GIVEN a config with testDir ./tests', () => {
    it('WHEN a spec under testDir is converted THEN the line is relative to testDir', () => {
      const line = toListLine('/r/apps/e/tests/a.spec.ts', '/r/apps/e/tests');

      expect(line).toBe('a.spec.ts');
    });
  });

  describe('GIVEN a config without testDir', () => {
    it('WHEN a nested spec is converted THEN the line is the posix path relative to the package root', () => {
      const line = toListLine('/r/apps/e/tests/auth/login.spec.ts', '/r/apps/e');

      expect(line).toBe('tests/auth/login.spec.ts');
    });
  });

  describe('GIVEN Windows paths', () => {
    it('WHEN a spec is converted THEN the line uses posix separators', () => {
      const line = toListLine('C:\\r\\apps\\e\\tests\\a.spec.ts', 'C:\\r\\apps\\e');

      expect(line).toBe('tests/a.spec.ts');
    });
  });
});
