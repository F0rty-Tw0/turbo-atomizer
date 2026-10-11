import { describe, expect, it } from 'vitest';

import { blobCountWarning, missingBlobMessage } from './blob-count.util.ts';
import type { BlobCollection } from '../common/reports.type.ts';

describe('FEATURE: blob count warning', () => {
  describe('GIVEN one blob per file task', () => {
    it('WHEN the counts are compared THEN there is no warning', () => {
      const blobs: BlobCollection = { copied: 6, missing: [] };

      const warning = blobCountWarning(blobs, 6);

      expect(warning).toBeUndefined();
    });
  });

  describe('GIVEN fewer blobs than file tasks', () => {
    it('WHEN the counts are compared THEN the warning names both counts', () => {
      const blobs: BlobCollection = { copied: 1, missing: [] };

      const warning = blobCountWarning(blobs, 6);

      expect(warning).toContain('1 of 6');
    });

    it('WHEN the counts are compared THEN the warning says an --affected run explains it', () => {
      const blobs: BlobCollection = { copied: 1, missing: [] };

      const warning = blobCountWarning(blobs, 6);

      expect(warning).toContain('--affected');
    });
  });

  describe('GIVEN no blobs at all', () => {
    it('WHEN the counts are compared THEN the warning names both counts', () => {
      const blobs: BlobCollection = { copied: 0, missing: [] };

      const warning = blobCountWarning(blobs, 6);

      expect(warning).toContain('0 of 6');
    });
  });

  describe('GIVEN no file tasks', () => {
    it('WHEN the counts are compared THEN the warning says there is nothing to merge', () => {
      const blobs: BlobCollection = { copied: 0, missing: [] };

      const warning = blobCountWarning(blobs, 0);

      expect(warning).toContain('no file tasks, so there is no blob report to merge');
    });
  });

  describe('GIVEN every file task without a blob ran', () => {
    it('WHEN the counts are compared THEN there is no --affected warning', () => {
      const blobs: BlobCollection = { copied: 1, missing: ['tests-b-spec-ts-222222'] };

      const warning = blobCountWarning(blobs, 2);

      expect(warning).toBeUndefined();
    });
  });
});

describe('FEATURE: missing blob message', () => {
  describe('GIVEN two file tasks that ran without a blob', () => {
    const missing = ['tests-a-spec-ts-111111', 'tests-b-spec-ts-222222'];

    it('WHEN the message is built THEN it says they ran but left no blob report', () => {
      const message = missingBlobMessage(missing);

      expect(message).toContain('2 file tasks ran but left no blob report');
    });

    it('WHEN the message is built THEN it names each slug dir', () => {
      const message = missingBlobMessage(missing);

      expect(message).toContain('.atomizer/tests-a-spec-ts-111111/, .atomizer/tests-b-spec-ts-222222/');
    });
  });
});
