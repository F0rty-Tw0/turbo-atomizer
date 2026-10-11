import { describe, expect, it } from 'vitest';

import { lastLines } from './log-tail.util.ts';

describe('FEATURE: log tail', (): void => {
  describe('GIVEN more lines than the limit', (): void => {
    it('WHEN the tail is taken THEN only the last lines remain', (): void => {
      const tail = lastLines('one\ntwo\nthree\nfour\n', 2);

      expect(tail).toBe('three\nfour\n');
    });
  });

  describe('GIVEN fewer lines than the limit', (): void => {
    it('WHEN the tail is taken THEN the text is unchanged', (): void => {
      const tail = lastLines('one\ntwo', 5);

      expect(tail).toBe('one\ntwo');
    });
  });

  describe('GIVEN an unterminated last line', (): void => {
    it('WHEN the tail is taken THEN the partial line counts as a line', (): void => {
      const tail = lastLines('one\ntwo\nthr', 2);

      expect(tail).toBe('two\nthr');
    });
  });

  describe('GIVEN empty text', (): void => {
    it('WHEN the tail is taken THEN it stays empty', (): void => {
      const tail = lastLines('', 3);

      expect(tail).toBe('');
    });
  });
});
