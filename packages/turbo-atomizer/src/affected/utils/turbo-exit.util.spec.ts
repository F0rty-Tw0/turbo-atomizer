import { constants } from 'node:os';

import { describe, expect, it } from 'vitest';

import { toTurboExitCode } from './turbo-exit.util.ts';
import type { TurboExit } from '../../shared/turbo/common/turbo-run.type.ts';

describe('FEATURE: turbo exit code', (): void => {
  describe('GIVEN turbo exits 0 after a forwarded interrupt', (): void => {
    it('WHEN the interrupt is SIGINT THEN the exit code is 130', (): void => {
      const exit: TurboExit = { code: 0, interrupt: 'SIGINT', signal: null };

      const code = toTurboExitCode(exit, constants.signals);

      expect(code).toBe(130);
    });

    it('WHEN the interrupt is SIGTERM THEN the exit code is 143', (): void => {
      const exit: TurboExit = { code: 0, interrupt: 'SIGTERM', signal: null };

      const code = toTurboExitCode(exit, constants.signals);

      expect(code).toBe(143);
    });
  });

  describe('GIVEN no forwarded interrupt', (): void => {
    it('WHEN turbo exits with a code THEN that code is returned', (): void => {
      const exit: TurboExit = { code: 3, interrupt: null, signal: null };

      const code = toTurboExitCode(exit, constants.signals);

      expect(code).toBe(3);
    });

    it('WHEN turbo is killed by SIGTERM THEN the exit code is 143', (): void => {
      const exit: TurboExit = { code: null, interrupt: null, signal: 'SIGTERM' };

      const code = toTurboExitCode(exit, constants.signals);

      expect(code).toBe(143);
    });
  });
});
