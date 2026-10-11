import { copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { syncPackage } from './sync.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture } from '../../test/utils/fixture-copy.spec.util.ts';
import type { TurboTaskDefinition } from '../common/atom-task.type.ts';
import type { AtomsDiff } from '../common/atoms-diff.type.ts';
import { HelperMissingException } from '../common/helper-missing.exception.ts';
import { SpecRejectedException } from '../common/spec-rejected.exception.ts';
import type { SyncResult } from '../common/sync.type.ts';
import { readGeneratedTasks } from '../test/utils/generated-turbo-json.spec.util.ts';

type GeneratedTasks = Record<string, TurboTaskDefinition>;

const LIST_TIMEOUT_MS = 60_000;
const ATOMS_FILE = 'tools/e2e-atoms/turbo.json';
const SPEC_PATHS = ['a.spec.ts', 'b.spec.ts', 'nested/c.spec.ts'];
const FILE_TASK_NAMES = ['e2e-ci--tests/a.spec.ts', 'e2e-ci--tests/b.spec.ts', 'e2e-ci--tests/nested/c.spec.ts'];
const NO_DIFF: AtomsDiff = { added: [], removed: [], changed: [] };
const SPEC_EXCLUSION = '!**/*.{spec,test}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}';

const isFileTask = ([, task]: [string, TurboTaskDefinition]): boolean => task.tags?.includes('atomizer:e2e-ci') ?? false;

const fileTasksOf = (tasks: GeneratedTasks): [string, TurboTaskDefinition][] => Object.entries(tasks).filter(isFileTask);

const fileInputsOf = (tasks: GeneratedTasks): (string[] | undefined)[] =>
  fileTasksOf(tasks).map(([, task]): string[] | undefined => task.inputs);

const carrierInputsOf = (tasks: GeneratedTasks): (string[] | undefined)[] =>
  SPEC_PATHS.map((spec): string[] | undefined => tasks[`e2e-ci-src--tests/${spec}`]?.inputs);

const blobFlagsOf = (tasks: GeneratedTasks): boolean[] =>
  fileTasksOf(tasks).map(([, task]): boolean => task.command?.includes('--atomizer-blob') ?? false);

const writeAtomizerConfig = async (packageDir: string, config: Record<string, unknown>): Promise<void> => {
  const text = JSON.stringify(config);

  await writeFile(join(packageDir, 'turbo-atomizer.json'), text);
};

describe('FEATURE: sync one test package', (): void => {
  describe('GIVEN a copy of the basic fixture with the default config', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = join(copy.directory, 'apps/e2e');
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    describe('WHEN it is synced the first time', (): void => {
      let result: SyncResult;
      let tasks: GeneratedTasks;

      beforeAll(async (): Promise<void> => {
        result = await syncPackage(packageDir, { check: false });
        tasks = await readGeneratedTasks(join(copy.directory, ATOMS_FILE));
      }, LIST_TIMEOUT_MS);

      it('THEN the generated turbo.json is written under the workspace root', (): void => {
        const diff: AtomsDiff = { ...NO_DIFF, added: FILE_TASK_NAMES };

        expect(result).toEqual({ written: true, stale: false, diff });
      });

      it('THEN it holds one file task per spec and none for the setup-only file', (): void => {
        const fileTaskNames = fileTasksOf(tasks).map(([name]): string => name);

        expect(fileTaskNames).toEqual(FILE_TASK_NAMES);
      });

      it('THEN each spec gets a carrier tagged atomizer:carrier', (): void => {
        const carrierTags = SPEC_PATHS.map((spec): string[] | undefined => tasks[`e2e-ci-src--tests/${spec}`]?.tags);

        expect(carrierTags).toEqual([['atomizer:carrier'], ['atomizer:carrier'], ['atomizer:carrier']]);
      });

      it('THEN each file task depends on its carrier', (): void => {
        const lastDependencies = fileTasksOf(tasks).map(([, task]): string | undefined => task.dependsOn?.at(-1));

        expect(lastDependencies).toEqual([
          'e2e-ci-src--tests/a.spec.ts',
          'e2e-ci-src--tests/b.spec.ts',
          'e2e-ci-src--tests/nested/c.spec.ts'
        ]);
      });

      it('THEN the list lines are relative to the tests directory', (): void => {
        const listLines = fileTasksOf(tasks).map(([, task]): string | undefined => task.command?.[4]);

        expect(listLines).toEqual(SPEC_PATHS);
      });

      it('THEN each command adds a blob reporter because the config has none', (): void => {
        expect(blobFlagsOf(tasks)).toEqual([true, true, true]);
      });

      it('THEN each file task excludes the snapshot folders and no config file, since none exists', (): void => {
        const inputs = ['$TURBO_DEFAULT$', SPEC_EXCLUSION, '!**/*-snapshots/**'];

        expect(fileInputsOf(tasks)).toEqual([inputs, inputs, inputs]);
      });

      it('THEN each carrier brings in its spec and its own snapshot folder', (): void => {
        const inputs = SPEC_PATHS.map((spec): string[] => [`tests/${spec}`, `tests/${spec}-snapshots/**`]);

        expect(carrierInputsOf(tasks)).toEqual(inputs);
      });

      it('THEN the aggregate task depends on the file tasks only', (): void => {
        expect(tasks['e2e-ci--all']).toEqual({ dependsOn: FILE_TASK_NAMES });
      });
    });

    it(
      'WHEN it is synced again THEN nothing is written',
      async (): Promise<void> => {
        const result = await syncPackage(packageDir, { check: false });

        expect(result).toEqual({ written: false, stale: false, diff: NO_DIFF });
      },
      LIST_TIMEOUT_MS
    );
  });

  describe('GIVEN a synced copy with a spec added since', (): void => {
    let copy: FixtureCopy;
    let atomsFile: string;
    let synced: string;
    let result: SyncResult;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');
      atomsFile = join(copy.directory, ATOMS_FILE);

      const packageDir = join(copy.directory, 'apps/e2e');

      await syncPackage(packageDir, { check: false });
      synced = await readFile(atomsFile, 'utf8');
      await copyFile(join(packageDir, 'tests/a.spec.ts'), join(packageDir, 'tests/d.spec.ts'));
      result = await syncPackage(packageDir, { check: true });
    }, LIST_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    describe('WHEN it is checked', (): void => {
      it('THEN it is stale and nothing is written', (): void => {
        expect(result.stale).toBe(true);
        expect(result.written).toBe(false);
      });

      it('THEN the diff lists the added file task only', (): void => {
        const diff: AtomsDiff = { ...NO_DIFF, added: ['e2e-ci--tests/d.spec.ts'] };

        expect(result.diff).toEqual(diff);
      });

      it('THEN the generated turbo.json is unchanged', async (): Promise<void> => {
        const current = await readFile(atomsFile, 'utf8');

        expect(current).toBe(synced);
      });
    });
  });

  describe('GIVEN a config file picking a Playwright config with a blob reporter and a snapshotDir', (): void => {
    let copy: FixtureCopy;
    let tasks: GeneratedTasks;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('basic');

      const packageDir = join(copy.directory, 'apps/e2e');

      await writeAtomizerConfig(packageDir, { playwrightConfig: 'playwright.blob.config.ts' });
      await syncPackage(packageDir, { check: false });
      tasks = await readGeneratedTasks(join(copy.directory, ATOMS_FILE));
    }, LIST_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    describe('WHEN it is synced', (): void => {
      it('THEN no command adds a blob reporter', (): void => {
        expect(blobFlagsOf(tasks)).toEqual([false, false, false]);
      });

      it('THEN each file task keeps the snapshots shared and excludes the config file', (): void => {
        const inputs = ['$TURBO_DEFAULT$', SPEC_EXCLUSION, '!turbo-atomizer.json'];

        expect(fileInputsOf(tasks)).toEqual([inputs, inputs, inputs]);
      });

      it('THEN each carrier brings in its spec only', (): void => {
        const inputs = SPEC_PATHS.map((spec): string[] => [`tests/${spec}`]);

        expect(carrierInputsOf(tasks)).toEqual(inputs);
      });
    });
  });

  describe('GIVEN a fresh copy of the basic fixture', (): void => {
    let copy: FixtureCopy;
    let packageDir: string;

    beforeEach(async (): Promise<void> => {
      copy = await copyFixture('basic');
      packageDir = join(copy.directory, 'apps/e2e');
    });

    afterEach(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN its config lists a spec outside the package THEN the spec is rejected by name',
      async (): Promise<void> => {
        await writeAtomizerConfig(packageDir, { playwrightConfig: 'playwright.outside.config.ts' });

        const sync = syncPackage(packageDir, { check: false });

        await expect(sync).rejects.toBeInstanceOf(SpecRejectedException);
        await expect(sync).rejects.toThrow('"../outside/x.spec.ts" is outside the test package');
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN no specGlobs entry matches a spec THEN the spec is rejected by name',
      async (): Promise<void> => {
        await writeAtomizerConfig(packageDir, { specGlobs: ['**/*.test.ts'] });

        const sync = syncPackage(packageDir, { check: false });

        await expect(sync).rejects.toThrow('"tests/a.spec.ts" matches no specGlobs entry');
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN a spec path holds a glob metacharacter THEN the spec is rejected by name',
      async (): Promise<void> => {
        await copyFile(join(packageDir, 'tests/a.spec.ts'), join(packageDir, 'tests/a[1].spec.ts'));

        const sync = syncPackage(packageDir, { check: false });

        await expect(sync).rejects.toThrow('"tests/a[1].spec.ts" holds the glob metacharacter "["');
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN Playwright would misparse a list line THEN the spec is rejected by name',
      async (): Promise<void> => {
        await copyFile(join(packageDir, 'tests/a.spec.ts'), join(packageDir, 'tests/a›b.spec.ts'));

        const sync = syncPackage(packageDir, { check: false });

        await expect(sync).rejects.toThrow('would misparse "a›b.spec.ts"');
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN its config lacks the helper THEN HelperMissingException is thrown',
      async (): Promise<void> => {
        await writeAtomizerConfig(packageDir, { playwrightConfig: 'playwright.unwrapped.config.ts' });

        const sync = syncPackage(packageDir, { check: false });

        await expect(sync).rejects.toBeInstanceOf(HelperMissingException);
      },
      LIST_TIMEOUT_MS
    );

    it(
      'WHEN it has no test file THEN only an aggregate task without dependsOn is written',
      async (): Promise<void> => {
        await rm(join(packageDir, 'tests'), { recursive: true });

        await syncPackage(packageDir, { check: false });

        const tasks = await readGeneratedTasks(join(copy.directory, ATOMS_FILE));

        expect(tasks).toEqual({ 'e2e-ci--all': {} });
      },
      LIST_TIMEOUT_MS
    );
  });
});
