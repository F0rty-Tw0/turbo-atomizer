import { describe, expect, it } from 'vitest';

import { parseAtomizerArgs } from './atomizer-args.util.ts';

describe('FEATURE: TURBO_ATOMIZER_ARGS parsing', (): void => {
  describe('GIVEN no value', (): void => {
    it.each([[undefined], [''], [' \t\n ']])('WHEN %j is parsed THEN there are no args', (value): void => {
      const args = parseAtomizerArgs(value);

      expect(args).toEqual([]);
    });
  });

  describe('GIVEN a plain value', (): void => {
    it('WHEN it is parsed THEN it splits on runs of whitespace', (): void => {
      const args = parseAtomizerArgs(' --grep  @smoke\t-j 2\n');

      expect(args).toEqual(['--grep', '@smoke', '-j', '2']);
    });
  });

  describe('GIVEN a value whose first non-space character is [', (): void => {
    it('WHEN it is a JSON array of strings THEN each string is one arg, spaces kept', (): void => {
      const args = parseAtomizerArgs(' ["--grep", "log in"]');

      expect(args).toEqual(['--grep', 'log in']);
    });

    it('WHEN it is invalid JSON THEN it is rejected', (): void => {
      const args = parseAtomizerArgs('[--grep');

      expect(args).toBeUndefined();
    });

    it('WHEN an item is not a string THEN it is rejected', (): void => {
      const args = parseAtomizerArgs('["--workers", 2]');

      expect(args).toBeUndefined();
    });
  });
});
