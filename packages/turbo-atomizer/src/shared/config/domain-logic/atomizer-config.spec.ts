import { describe, expect, it } from 'vitest';

import { loadAtomizerConfig } from './atomizer-config.ts';
import type { AtomizerConfig } from '../common/atomizer-config.type.ts';
import { ConfigConflictException } from '../common/config-conflict.exception.ts';
import { ConfigInvalidException } from '../common/config-invalid.exception.ts';
import { configFixtureDir } from '../test/utils/config-fixture.spec.util.ts';

describe('FEATURE: atomizer config loading', (): void => {
  describe('GIVEN a package with turbo-atomizer.json', (): void => {
    describe('WHEN the config is loaded', (): void => {
      it('THEN the source is file', async (): Promise<void> => {
        const loaded = await loadAtomizerConfig(configFixtureDir('file-config'));

        expect(loaded.source).toBe('file');
      });

      it('THEN the file fields are merged over the defaults', async (): Promise<void> => {
        const server = { idleMs: 5000 };
        const uncached = { patterns: ['**/*.live.spec.ts'] };
        const expected: AtomizerConfig = {
          dependsOn: ['^build'],
          env: [],
          extraInputs: [],
          failOnFlaky: true,
          generatedPackage: 'tools/custom-atoms',
          passThroughEnv: [],
          playwrightConfig: 'playwright.config.mjs',
          server,
          snapshotGlobs: ['**/*-snapshots/**'],
          specGlobs: ['**/*.{spec,test}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
          task: 'e2e',
          uncached
        };

        const loaded = await loadAtomizerConfig(configFixtureDir('file-config'));

        expect(loaded.config).toEqual(expected);
      });
    });
  });

  describe('GIVEN a package with a "turbo-atomizer" key in package.json', (): void => {
    describe('WHEN the config is loaded', (): void => {
      it('THEN the source is package-json', async (): Promise<void> => {
        const loaded = await loadAtomizerConfig(configFixtureDir('package-json-config'));

        expect(loaded.source).toBe('package-json');
      });

      it('THEN the key fields are applied', async (): Promise<void> => {
        const loaded = await loadAtomizerConfig(configFixtureDir('package-json-config'));

        expect(loaded.config).toMatchObject({ playwrightConfig: 'e2e.config.ts', task: 'smoke' });
      });
    });
  });

  describe('GIVEN a package with both turbo-atomizer.json and a package.json key', (): void => {
    it('WHEN the config is loaded THEN it rejects with ConfigConflictException', async (): Promise<void> => {
      const loading = loadAtomizerConfig(configFixtureDir('both-configs'));

      await expect(loading).rejects.toBeInstanceOf(ConfigConflictException);
    });
  });

  describe('GIVEN a package with no atomizer config and no Playwright config', (): void => {
    describe('WHEN the config is loaded', (): void => {
      it('THEN the source is default', async (): Promise<void> => {
        const loaded = await loadAtomizerConfig(configFixtureDir('no-config'));

        expect(loaded.source).toBe('default');
      });

      it('THEN every field holds its default', async (): Promise<void> => {
        const server = { idleMs: 5000 };
        const uncached = { patterns: [] };
        const expected: AtomizerConfig = {
          dependsOn: ['^build'],
          env: [],
          extraInputs: [],
          failOnFlaky: false,
          generatedPackage: 'tools/no-config-atoms',
          passThroughEnv: [],
          playwrightConfig: 'playwright.config.ts',
          server,
          snapshotGlobs: ['**/*-snapshots/**'],
          specGlobs: ['**/*.{spec,test}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
          task: 'e2e-ci',
          uncached
        };

        const loaded = await loadAtomizerConfig(configFixtureDir('no-config'));

        expect(loaded.config).toEqual(expected);
      });
    });
  });

  describe('GIVEN a turbo-atomizer.json with { "task": 3 }', (): void => {
    describe('WHEN the config is loaded', (): void => {
      it('THEN it rejects with ConfigInvalidException', async (): Promise<void> => {
        const loading = loadAtomizerConfig(configFixtureDir('invalid-config'));

        await expect(loading).rejects.toBeInstanceOf(ConfigInvalidException);
      });

      it('THEN the message names the task field', async (): Promise<void> => {
        const loading = loadAtomizerConfig(configFixtureDir('invalid-config'));

        await expect(loading).rejects.toThrow(/task/);
      });
    });
  });

  describe('GIVEN a package.json key with { "task": 3 }', (): void => {
    it('WHEN the config is loaded THEN the message names the package.json key', async (): Promise<void> => {
      const loading = loadAtomizerConfig(configFixtureDir('invalid-package-json-config'));

      await expect(loading).rejects.toThrow(/package\.json "turbo-atomizer"/);
    });
  });
});
