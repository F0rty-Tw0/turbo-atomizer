import { describe, expect, it, vi } from 'vitest';

import { queryTurboFacts } from './doctor-turbo-facts.ts';
import { TurboQueryException } from '../../shared/turbo/common/turbo-query.exception.ts';
import type { TurboScan } from '../common/doctor-facts.type.ts';
import { doctorDepsMock } from '../test/mocks/doctor.mock.ts';
import { TURBO_SCAN_STUB, WEB_PACKAGE_TASKS_STUB } from '../test/stubs/doctor-facts.stub.ts';

describe('FEATURE: query turbo facts', (): void => {
  describe('GIVEN a queryable package', (): void => {
    it('WHEN turbo query fails THEN the facts are empty and carry the failure', async (): Promise<void> => {
      const deps = doctorDepsMock();
      const failure = new TurboQueryException('exit code 1 in /repo', "x Cannot extend from 'web-e2e-atoms'");

      vi.mocked(deps.queryPackageTasks).mockRejectedValue(failure);

      const facts = await queryTurboFacts(TURBO_SCAN_STUB, deps);

      expect(facts).toEqual({ dependencyTasks: [], outsideImports: [], turboQueryFailure: failure.message });
    });

    it('WHEN the query fails with any other error THEN that error is thrown', async (): Promise<void> => {
      const deps = doctorDepsMock();

      vi.mocked(deps.queryPackageTasks).mockRejectedValue(new Error('unexpected result shape'));

      const querying = queryTurboFacts(TURBO_SCAN_STUB, deps);

      await expect(querying).rejects.toThrow('unexpected result shape');
    });

    it('WHEN the generated file is stale THEN the dependency tasks are read and no spec is queried for imports', async (): Promise<void> => {
      const deps = doctorDepsMock();
      const scan: TurboScan = { ...TURBO_SCAN_STUB, isStale: true };

      const facts = await queryTurboFacts(scan, deps);

      expect(facts).toEqual({ dependencyTasks: [WEB_PACKAGE_TASKS_STUB], outsideImports: [], turboQueryFailure: undefined });
      expect(deps.queryFileDeps).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a package whose root turbo.json lacks experimentalTaskCommand', (): void => {
    it('WHEN the facts are queried THEN turbo is never queried', async (): Promise<void> => {
      const deps = doctorDepsMock();
      const scan: TurboScan = { ...TURBO_SCAN_STUB, isQueryable: false };

      const facts = await queryTurboFacts(scan, deps);

      expect(facts).toEqual({ dependencyTasks: [], outsideImports: [], turboQueryFailure: undefined });
      expect(deps.queryPackageTasks).not.toHaveBeenCalled();
    });
  });
});
