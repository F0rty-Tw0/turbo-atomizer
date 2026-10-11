import { describe, expect, it } from 'vitest';

import { isReadyStatus } from './probe-status.util.ts';

describe('FEATURE: probe status', () => {
  describe('GIVEN statuses from 200 through 403', () => {
    it('WHEN each is classified THEN all are ready', () => {
      const statuses = [200, 302, 403];

      const ready = statuses.map(isReadyStatus);

      expect(ready).toEqual([true, true, true]);
    });
  });

  describe('GIVEN statuses outside 200 through 403', () => {
    it('WHEN each is classified THEN none is ready', () => {
      const statuses = [199, 404, 500];

      const ready = statuses.map(isReadyStatus);

      expect(ready).toEqual([false, false, false]);
    });
  });
});
