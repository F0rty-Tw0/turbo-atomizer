import { describe, expect, it } from 'vitest';

import { nextProbeDelay } from './probe-schedule.util.ts';

describe('FEATURE: probe schedule', () => {
  describe('GIVEN the first five probe attempts', () => {
    it('WHEN each delay is read THEN it backs off 100, 250, 500 ms and then stays at 1 s', () => {
      const attempts = [0, 1, 2, 3, 4];

      const delays = attempts.map(nextProbeDelay);

      expect(delays).toEqual([100, 250, 500, 1000, 1000]);
    });
  });
});
