import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runTurbo } from './turbo-run.process.ts';
import type { FixtureCopy } from '../../../test/common/fixture-copy.type.ts';
import type { TurboExit } from '../common/turbo-run.type.ts';
import { copyQueryWorkspace } from '../test/utils/query-workspace.spec.util.ts';

const RUN_TIMEOUT_MS = 60_000;

describe('FEATURE: turbo run process', (): void => {
  describe('GIVEN a workspace whose test package defines a file task', (): void => {
    let workspace: FixtureCopy;

    beforeEach(async (): Promise<void> => {
      workspace = await copyQueryWorkspace();
    });

    afterEach(async (): Promise<void> => {
      await workspace.dispose();
    });

    it(
      'WHEN the file task is run filtered to its package THEN turbo exits 0',
      async (): Promise<void> => {
        const expected: TurboExit = { code: 0, interrupt: null, signal: null };

        const exit = await runTurbo(workspace.directory, ['e2e-ci--tests/a.spec.ts', '--filter=web-e2e']);

        expect(exit).toEqual(expected);
      },
      RUN_TIMEOUT_MS
    );

    it(
      'WHEN an unknown task is run THEN turbo exits non-zero',
      async (): Promise<void> => {
        const exit = await runTurbo(workspace.directory, ['no-such-task', '--filter=web-e2e']);

        expect(exit.code).not.toBe(0);
      },
      RUN_TIMEOUT_MS
    );

    it(
      'WHEN SIGTERM arrives while turbo runs THEN the exit records it as the interrupt',
      async (): Promise<void> => {
        const listenersBefore = process.listenerCount('SIGTERM');
        const running = runTurbo(workspace.directory, ['e2e-ci--tests/a.spec.ts', '--filter=web-e2e']);
        const isTurboRunning = (): void => {
          expect(process.listenerCount('SIGTERM')).toBeGreaterThan(listenersBefore);
        };

        await vi.waitFor(isTurboRunning, { interval: 5, timeout: RUN_TIMEOUT_MS });
        process.emit('SIGTERM', 'SIGTERM');

        const exit = await running;

        expect(exit.interrupt).toBe('SIGTERM');
      },
      RUN_TIMEOUT_MS
    );
  });
});
