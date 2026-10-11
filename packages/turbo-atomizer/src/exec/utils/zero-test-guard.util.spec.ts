import { describe, expect, it } from 'vitest';

import { zeroTestVerdict } from './zero-test-guard.util.ts';

describe('FEATURE: zero-test guard', () => {
  describe('GIVEN no count file was written', () => {
    it('WHEN no filter was forwarded THEN the verdict is missing', () => {
      const verdict = zeroTestVerdict(undefined, false);

      expect(verdict).toBe('missing');
    });

    it('WHEN a filter was forwarded THEN the verdict is still missing', () => {
      const verdict = zeroTestVerdict(undefined, true);

      expect(verdict).toBe('missing');
    });
  });

  describe('GIVEN zero selected tests', () => {
    it('WHEN no filter was forwarded THEN the verdict is empty', () => {
      const verdict = zeroTestVerdict({ selected: 0 }, false);

      expect(verdict).toBe('empty');
    });

    it('WHEN a filter was forwarded THEN the verdict is ok', () => {
      const verdict = zeroTestVerdict({ selected: 0 }, true);

      expect(verdict).toBe('ok');
    });
  });

  describe('GIVEN selected tests', () => {
    it('WHEN no filter was forwarded THEN the verdict is ok', () => {
      const verdict = zeroTestVerdict({ selected: 2 }, false);

      expect(verdict).toBe('ok');
    });
  });
});
