import { constants } from 'node:os';

import { describe, expect, it } from 'vitest';

import { toExitCode } from './exit-code.util.ts';

describe('FEATURE: exit code', () => {
  describe('GIVEN Playwright exited with a code', () => {
    it('WHEN the code is 0 THEN the exit code is 0', () => {
      const exitCode = toExitCode(0, null, constants.signals);

      expect(exitCode).toBe(0);
    });

    it('WHEN the code is 2 THEN the exit code is 2', () => {
      const exitCode = toExitCode(2, null, constants.signals);

      expect(exitCode).toBe(2);
    });
  });

  describe('GIVEN Playwright died by a signal', () => {
    it('WHEN the signal is SIGTERM THEN the exit code is 143', () => {
      const exitCode = toExitCode(null, 'SIGTERM', constants.signals);

      expect(exitCode).toBe(143);
    });

    it('WHEN the signal is SIGINT THEN the exit code is 130', () => {
      const exitCode = toExitCode(null, 'SIGINT', constants.signals);

      expect(exitCode).toBe(130);
    });

    it('WHEN the signal has no number on this platform THEN the exit code is 1', () => {
      const exitCode = toExitCode(null, 'SIGTERM', {});

      expect(exitCode).toBe(1);
    });
  });

  describe('GIVEN Playwright reported neither a code nor a signal', () => {
    it('WHEN the exit code is computed THEN it is 1', () => {
      const exitCode = toExitCode(null, null, constants.signals);

      expect(exitCode).toBe(1);
    });
  });
});
