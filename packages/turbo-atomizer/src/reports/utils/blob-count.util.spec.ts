import { describe, expect, it } from 'vitest';

import { blobCountWarning } from './blob-count.util.ts';

describe('FEATURE: blob count warning', () => {
  describe('GIVEN one blob per file task', () => {
    it('WHEN the counts are compared THEN there is no warning', () => {
      const warning = blobCountWarning(6, 6);

      expect(warning).toBeUndefined();
    });
  });

  describe('GIVEN fewer blobs than file tasks', () => {
    it('WHEN the counts are compared THEN the warning names both counts', () => {
      const warning = blobCountWarning(1, 6);

      expect(warning).toContain('1 of 6');
    });

    it('WHEN the counts are compared THEN the warning says an --affected run explains it', () => {
      const warning = blobCountWarning(1, 6);

      expect(warning).toContain('--affected');
    });
  });

  describe('GIVEN no blobs at all', () => {
    it('WHEN the counts are compared THEN the warning names both counts', () => {
      const warning = blobCountWarning(0, 6);

      expect(warning).toContain('0 of 6');
    });
  });
});
