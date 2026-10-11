import { describe, expect, it } from 'vitest';

import { formatSyncError, formatSyncResult } from './sync-summary.util.ts';
import type { AtomsDiff } from '../common/atoms-diff.type.ts';
import type { SyncResult } from '../common/sync.type.ts';

const NO_DIFF: AtomsDiff = { added: [], removed: [], changed: [] };
const CURRENT_RESULT: SyncResult = { diff: NO_DIFF, stale: false, written: false };

describe('FEATURE: sync summary', (): void => {
  describe('GIVEN a package whose generated turbo.json is current', (): void => {
    it('WHEN its result is formatted THEN one up-to-date line is returned', (): void => {
      const summary = formatSyncResult('apps/e2e', CURRENT_RESULT);

      expect(summary).toBe('apps/e2e: up to date\n');
    });
  });

  describe('GIVEN a package whose generated turbo.json was written', (): void => {
    it('WHEN its result is formatted THEN the changed file tasks follow the updated line', (): void => {
      const diff: AtomsDiff = { ...NO_DIFF, changed: ['e2e-ci--tests/a.spec.ts'] };
      const result: SyncResult = { ...CURRENT_RESULT, diff, written: true };

      const summary = formatSyncResult('apps/e2e', result);

      expect(summary).toBe('apps/e2e: updated\n  changed: e2e-ci--tests/a.spec.ts\n');
    });
  });

  describe('GIVEN a package that is stale under --check', (): void => {
    it('WHEN its result is formatted THEN added, removed and changed file tasks are listed in that order', (): void => {
      const diff: AtomsDiff = {
        added: ['e2e-ci--tests/d.spec.ts'],
        removed: ['e2e-ci--tests/old.spec.ts'],
        changed: ['e2e-ci--tests/a.spec.ts']
      };
      const result: SyncResult = { ...CURRENT_RESULT, diff, stale: true };
      const expectedLines = [
        'apps/e2e: stale; run turbo-atomizer sync and commit the result',
        '  added: e2e-ci--tests/d.spec.ts',
        '  removed: e2e-ci--tests/old.spec.ts',
        '  changed: e2e-ci--tests/a.spec.ts',
        ''
      ];
      const expected = expectedLines.join('\n');

      const summary = formatSyncResult('apps/e2e', result);

      expect(summary).toBe(expected);
    });
  });

  describe('GIVEN a failed sync', (): void => {
    it('WHEN an Error is formatted THEN its message follows the package dir', (): void => {
      const error = new Error('No helper');

      const line = formatSyncError('apps/e2e', error);

      expect(line).toBe('apps/e2e: No helper\n');
    });

    it('WHEN a thrown non-Error is formatted THEN its string form follows the package dir', (): void => {
      const line = formatSyncError('apps/e2e', 'boom');

      expect(line).toBe('apps/e2e: boom\n');
    });
  });
});
