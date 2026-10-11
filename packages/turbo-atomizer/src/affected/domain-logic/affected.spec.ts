import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { affectedPackage } from './affected.ts';
import { fixtureDirectory } from '../../test/utils/fixture-copy.spec.util.ts';
import type { AffectedDeps } from '../common/affected.type.ts';

type AffectedProbe = {
  readonly deps: AffectedDeps;
  readonly calls: unknown[][];
};

const ROOT = fixtureDirectory('basic');
const PACKAGE_DIR = join(ROOT, 'apps/e2e');

const affectedProbe = (fullNames: string[], turboCode: number): AffectedProbe => {
  const calls: unknown[][] = [];

  const queryAffectedTasks = async (root: string, task: string): Promise<string[]> => {
    calls.push(['query', root, task]);

    return Promise.resolve(fullNames);
  };

  const runTurbo = async (root: string, args: string[]): Promise<number> => {
    calls.push(['run', root, args]);

    return Promise.resolve(turboCode);
  };

  const deps: AffectedDeps = { queryAffectedTasks, runTurbo };
  const probe: AffectedProbe = { deps, calls };

  return probe;
};

describe('FEATURE: affected package', (): void => {
  let stdoutSpy: MockInstance<typeof process.stdout.write>;
  let stderrSpy: MockInstance<typeof process.stderr.write>;

  beforeEach((): void => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN no affected file task in the test package', (): void => {
    it('WHEN run THEN it prints a notice, skips turbo run and exits 0', async (): Promise<void> => {
      const probe = affectedProbe(['e2e-atoms#e2e-ci--tests/a.spec.ts'], 0);
      const queryCall = ['query', ROOT, 'e2e-ci'];

      const code = await affectedPackage(PACKAGE_DIR, [], probe.deps);

      expect(code).toBe(0);
      expect(probe.calls).toEqual([queryCall]);
      expect(stdoutSpy).toHaveBeenCalledWith('no affected file tasks in e2e\n');
    });
  });

  describe('GIVEN affected file tasks in the test package and its generated copy', (): void => {
    const fullNames = ['e2e#e2e-ci--tests/b.spec.ts', 'e2e-atoms#e2e-ci--tests/b.spec.ts', 'e2e#e2e-ci--tests/a.spec.ts'];

    it('WHEN run THEN turbo runs only the own tasks from the workspace root with the forwarded args', async (): Promise<void> => {
      const probe = affectedProbe(fullNames, 0);
      const args = [
        'e2e-ci--tests/a.spec.ts',
        'e2e-ci--tests/b.spec.ts',
        '--filter=e2e',
        '--continue=dependencies-successful',
        '--concurrency=2'
      ];
      const runCall = ['run', ROOT, args];

      const code = await affectedPackage(PACKAGE_DIR, ['--concurrency=2'], probe.deps);

      expect(code).toBe(0);
      expect(probe.calls[1]).toEqual(runCall);
    });

    it('WHEN turbo exits non-zero THEN that code is returned', async (): Promise<void> => {
      const probe = affectedProbe(fullNames, 3);

      const code = await affectedPackage(PACKAGE_DIR, [], probe.deps);

      expect(code).toBe(3);
    });
  });

  describe('GIVEN a test package whose package.json has no name', (): void => {
    let directory: string;

    beforeEach(async (): Promise<void> => {
      directory = await mkdtemp(join(tmpdir(), 'atomizer-affected-'));
      await writeFile(join(directory, 'package.json'), '{ "private": true }\n');
    });

    afterEach(async (): Promise<void> => {
      await rm(directory, { force: true, recursive: true });
    });

    it('WHEN run THEN it reports the missing name, queries nothing and exits 1', async (): Promise<void> => {
      const probe = affectedProbe([], 0);

      const code = await affectedPackage(directory, [], probe.deps);

      expect(code).toBe(1);
      expect(probe.calls).toEqual([]);
      expect(stderrSpy).toHaveBeenCalledWith(`turbo-atomizer affected: ${join(directory, 'package.json')} has no name\n`);
    });
  });
});
