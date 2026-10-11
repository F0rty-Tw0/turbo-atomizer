import { beforeAll, describe, expect, it } from 'vitest';

import { PNPM_BASIC_SPECS } from './test/common/fixture-workspace.const.ts';
import type { FixtureWorkspace } from './test/common/fixture-workspace.type.ts';
import { createSyncedWorkspace } from './test/utils/atomizer-setup.spec.util.ts';
import { startupCostReport } from './test/utils/startup-cost.spec.util.ts';
import { missedFileTaskIds, summarizedRun } from './test/utils/turbo-summary.spec.util.ts';
import { outputOf } from './test/utils/workspace-command.spec.util.ts';

describe('FEATURE: per-file start-up cost', (): void => {
  describe('GIVEN the pnpm-basic workspace, initialized and synced', (): void => {
    let workspace: FixtureWorkspace;

    beforeAll(async (): Promise<() => Promise<void>> => {
      workspace = await createSyncedWorkspace('pnpm-basic', 'pnpm');

      return workspace.dispose;
    });

    it('WHEN the suite runs cold and then from cache THEN the timings are recorded, whatever they are', async (): Promise<void> => {
      const cold = await summarizedRun(workspace.root, 'turbo run e2e-ci');
      const cached = await summarizedRun(workspace.root, 'turbo run e2e-ci');

      process.stdout.write(startupCostReport(cold, cached));

      expect(cold.result, outputOf(cold.result)).toMatchObject({ exitCode: 0 });
      expect(cached.result, outputOf(cached.result)).toMatchObject({ exitCode: 0 });
      expect(missedFileTaskIds(cold.tasks)).toHaveLength(PNPM_BASIC_SPECS.length);
      expect(missedFileTaskIds(cached.tasks)).toEqual([]);
    });
  });
});
