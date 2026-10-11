import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { initPackage } from './init.ts';
import { PeerVersionException } from '../../shared/workspace/common/peer-version.exception.ts';
import type { PackageManager } from '../../shared/workspace/common/workspace.type.ts';
import type { FixtureCopy } from '../../test/common/fixture-copy.type.ts';
import { copyFixture, readFixtureTree } from '../../test/utils/fixture-copy.spec.util.ts';
import type { InitDeps, InitOptions, InitReport, PeerVersions } from '../common/init.type.ts';
import { initDepsMock } from '../test/mocks/init.mock.ts';
import { PEER_VERSIONS_STUB } from '../test/stubs/init.stub.ts';
import { initNextSteps } from '../utils/init-summary.util.ts';

type InstallCall = [string, PackageManager];

const LIST_TIMEOUT_MS = 60_000;

const WRAPPED_CONFIG = `import { defineConfig } from '@playwright/test';

import { withAtomizer } from '../../../../../playwright.ts';

export default withAtomizer(defineConfig({ testDir: './tests' }));
`;

const optionsFor = (copy: FixtureCopy): InitOptions => {
  const packageDir = join(copy.directory, 'apps/web-e2e');
  const options: InitOptions = { cliVersion: '0.1.0', packageDir };

  return options;
};

/** Vitest clears mock calls before each test, so a case reads the calls its `beforeAll` captured. */
const installCalls = (deps: InitDeps): InstallCall[] => [...vi.mocked(deps.install).mock.calls];

const readText = async (copy: FixtureCopy, path: string): Promise<string> => readFile(join(copy.directory, path), 'utf8');

const readJson = async (copy: FixtureCopy, path: string): Promise<unknown> => {
  const text = await readText(copy, path);
  const value: unknown = JSON.parse(text);

  return value;
};

describe('FEATURE: init package', (): void => {
  describe('GIVEN an init-pnpm copy initialized once', (): void => {
    let copy: FixtureCopy;
    let deps: InitDeps;
    let installs: InstallCall[];
    let report: InitReport;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
      deps = initDepsMock();
      report = await initPackage(optionsFor(copy), deps);
      installs = installCalls(deps);
    }, LIST_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it('THEN turbo-atomizer.json names the generated package dir', async (): Promise<void> => {
      const config = await readJson(copy, 'apps/web-e2e/turbo-atomizer.json');

      expect(config).toEqual({ generatedPackage: 'tools/web-e2e-atoms' });
    });

    it('THEN the root turbo.jsonc gains both future flags and keeps its comment', async (): Promise<void> => {
      const text = await readText(copy, 'turbo.jsonc');

      expect(text).toContain('// Shared task defaults for the acme workspace.');
      expect(text).toMatch(/"futureFlags": \{\s*"experimentalTaskCommand": true,\s*"affectedUsingTaskInputs": true\s*\}/);
    });

    it('THEN pnpm-workspace.yaml covers the generated dir and keeps its comments', async (): Promise<void> => {
      const text = await readText(copy, 'pnpm-workspace.yaml');

      expect(text).toContain('# Apps and their e2e suites.');
      expect(text).toContain("- 'apps/*' # every app");
      expect(text).toContain('- tools/web-e2e-atoms');
    });

    it('THEN the generated turbo.json is tagged atomizer:definitions and holds e2e-ci--all', async (): Promise<void> => {
      const tasks = { 'e2e-ci--all': {} };

      const turboJson = await readJson(copy, 'tools/web-e2e-atoms/turbo.json');

      expect(turboJson).toEqual({ extends: ['//'], tags: ['atomizer:definitions'], tasks });
    });

    it('THEN the test package turbo.json extends the generated package and its e2e-ci depends on e2e-ci--all', async (): Promise<void> => {
      const umbrellaTask = { dependsOn: ['e2e-ci--all'] };
      const tasks = { 'e2e-ci': umbrellaTask };

      const turboJson = await readJson(copy, 'apps/web-e2e/turbo.json');

      expect(turboJson).toEqual({ extends: ['//', '@acme/web-e2e-atoms'], tasks });
    });

    it('THEN .gitignore gains the output dir and the merge config', async (): Promise<void> => {
      const text = await readText(copy, '.gitignore');

      expect(text).toBe('node_modules\n.atomizer/\nplaywright.atomizer-merge.config.mjs\n');
    });

    it('THEN the root devDependencies gain turbo-atomizer at ^<cliVersion>', async (): Promise<void> => {
      const manifest = await readJson(copy, 'package.json');

      expect(manifest).toHaveProperty(['devDependencies', 'turbo-atomizer'], '^0.1.0');
    });

    it('THEN the install runs once, in the workspace root, with pnpm', (): void => {
      expect(installs).toEqual([[copy.directory, 'pnpm']]);
    });

    it('THEN sync is skipped because the config is not wrapped, and the report lists the next steps', (): void => {
      const nextSteps = initNextSteps('playwright.config.ts', '@acme/web-e2e');

      expect(report).toMatchObject({ lockfile: 'pnpm-lock.yaml', nextSteps, sync: undefined, warnings: [] });
      expect(report.changes).toHaveLength(7);
    });

    describe('WHEN init runs again', (): void => {
      let before: Map<string, string>;
      let rerun: InitReport;
      let rerunInstalls: InstallCall[];

      beforeAll(async (): Promise<void> => {
        before = await readFixtureTree(copy.directory);
        vi.mocked(deps.install).mockClear();
        rerun = await initPackage(optionsFor(copy), deps);
        rerunInstalls = installCalls(deps);
      }, LIST_TIMEOUT_MS);

      it('THEN no file changes', async (): Promise<void> => {
        const after = await readFixtureTree(copy.directory);

        expect(rerun.changes).toEqual([]);
        expect(after).toEqual(before);
      });

      it('THEN the install is not called again', (): void => {
        expect(rerunInstalls).toEqual([]);
      });
    });
  });

  describe('GIVEN an init-pnpm copy whose root already lists turbo-atomizer as a tarball', (): void => {
    let copy: FixtureCopy;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
      await writeFile(
        join(copy.directory, 'package.json'),
        '{ "name": "acme", "devDependencies": { "turbo-atomizer": "file:../x.tgz" } }\n'
      );
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it(
      'WHEN init runs THEN the tarball spec is kept',
      async (): Promise<void> => {
        await initPackage(optionsFor(copy), initDepsMock());

        const manifest = await readJson(copy, 'package.json');

        expect(manifest).toHaveProperty(['devDependencies', 'turbo-atomizer'], 'file:../x.tgz');
      },
      LIST_TIMEOUT_MS
    );
  });

  describe('GIVEN an init-pnpm copy and Playwright below the minimum', (): void => {
    let copy: FixtureCopy;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
    });

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it('WHEN init runs THEN it rejects with PeerVersionException and the copy is byte-identical', async (): Promise<void> => {
      const tooOld: PeerVersions = { ...PEER_VERSIONS_STUB, playwright: '1.55.0' };
      const deps = initDepsMock();
      const before = await readFixtureTree(copy.directory);

      vi.mocked(deps.versions).mockResolvedValue(tooOld);

      const running = initPackage(optionsFor(copy), deps);

      await expect(running).rejects.toBeInstanceOf(PeerVersionException);
      await expect(readFixtureTree(copy.directory)).resolves.toEqual(before);
    });
  });

  describe('GIVEN an init-npm copy', (): void => {
    let copy: FixtureCopy;
    let installs: InstallCall[];
    let report: InitReport;

    beforeAll(async (): Promise<void> => {
      const deps = initDepsMock();

      copy = await copyFixture('init-npm');
      report = await initPackage(optionsFor(copy), deps);
      installs = installCalls(deps);
    }, LIST_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it('WHEN init has run THEN the package.json workspaces cover the generated dir', async (): Promise<void> => {
      const manifest = await readJson(copy, 'package.json');

      expect(manifest).toHaveProperty(['workspaces'], ['apps/*', 'tools/web-e2e-atoms']);
    });

    it('WHEN init has run THEN npm installs and the report names package-lock.json', (): void => {
      expect(installs).toEqual([[copy.directory, 'npm']]);
      expect(report.lockfile).toBe('package-lock.json');
    });
  });

  describe('GIVEN an init-pnpm copy whose Playwright config is wrapped in withAtomizer', (): void => {
    let copy: FixtureCopy;
    let report: InitReport;

    beforeAll(async (): Promise<void> => {
      copy = await copyFixture('init-pnpm');
      await writeFile(join(copy.directory, 'apps/web-e2e/playwright.config.ts'), WRAPPED_CONFIG);
      report = await initPackage(optionsFor(copy), initDepsMock());
    }, LIST_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await copy.dispose();
    });

    it('WHEN init has run THEN sync wrote the file tasks and no next steps are left', async (): Promise<void> => {
      const sync = { written: true };

      const turboJson = await readJson(copy, 'tools/web-e2e-atoms/turbo.json');

      expect(report).toMatchObject({ nextSteps: [], sync });
      expect(turboJson).toHaveProperty(['tasks', 'e2e-ci--tests/home.spec.ts']);
    });
  });
});
