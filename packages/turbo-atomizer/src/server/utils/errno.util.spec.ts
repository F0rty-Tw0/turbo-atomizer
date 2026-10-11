import { describe, expect, it } from 'vitest';

import { errorCode } from './errno.util.ts';

describe('FEATURE: errno code', (): void => {
  describe('GIVEN an error carrying a string code', (): void => {
    it('WHEN its code is read THEN the code is returned', (): void => {
      const error = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' });

      const code = errorCode(error);

      expect(code).toBe('ECONNREFUSED');
    });
  });

  describe('GIVEN an error without a code', (): void => {
    it('WHEN its code is read THEN undefined is returned', (): void => {
      const code = errorCode(new Error('plain'));

      expect(code).toBeUndefined();
    });
  });

  describe('GIVEN an error with a numeric code', (): void => {
    it('WHEN its code is read THEN undefined is returned', (): void => {
      const error = Object.assign(new Error('numeric'), { code: 1 });

      const code = errorCode(error);

      expect(code).toBeUndefined();
    });
  });

  describe('GIVEN a thrown value that is not an Error', (): void => {
    it('WHEN its code is read THEN undefined is returned', (): void => {
      const code = errorCode({ code: 'EEXIST' });

      expect(code).toBeUndefined();
    });
  });
});
