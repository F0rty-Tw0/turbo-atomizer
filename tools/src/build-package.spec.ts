import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { readJsonFile } from '@nx/devkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildPackage } from './build-package.ts';
import type { PackageManifest } from './common/build-package.type.ts';
import {
  binTargets,
  catalogSpecifiers,
  exportTargets,
  importTargets,
  requireTargets
} from './test/utils/published-manifest.spec.util.ts';

const execFileAsync = promisify(execFile);

const packageRoot = resolve(import.meta.dirname, '../../packages/turbo-atomizer');

// exec.cjs runs exec as soon as it loads; exiting synchronously after the loop proves every require() returned without letting that run start.
const REQUIRE_SCRIPT = 'for (const target of process.argv.slice(1)) require(target); process.exit(0);';

const IMPORT_SCRIPT = 'for (const target of process.argv.slice(1)) await import(target);';

const ENTRY_FILES = [
  'cli.js',
  'count-reporter.cjs',
  'exec.cjs',
  'index.d.ts',
  'index.js',
  'playwright.cjs',
  'playwright.d.ts',
  'playwright.js',
  'schema.json',
  'supervisor.js'
];

describe('FEATURE: build package', (): void => {
  describe('GIVEN the turbo-atomizer package built into a temp dir', (): void => {
    let outDir = '';

    beforeAll(async (): Promise<void> => {
      outDir = await mkdtemp(join(tmpdir(), 'build-package-'));
      await buildPackage('packages/turbo-atomizer', outDir);
      await symlink(join(packageRoot, 'node_modules'), join(outDir, 'node_modules'), 'junction');
    });

    afterAll(async (): Promise<void> => {
      await rm(outDir, { force: true, recursive: true });
    });

    describe('WHEN the published manifest is read', (): void => {
      let manifest: PackageManifest;

      beforeAll((): void => {
        manifest = readJsonFile<PackageManifest>(join(outDir, 'package.json'));
      });

      it('THEN ./exec is required from a .cjs file', (): void => {
        const cjsPath: unknown = expect.stringMatching(/\.cjs$/);

        expect(manifest).toHaveProperty(['exports', './exec', 'require'], cjsPath);
      });

      it('THEN ./schema.json is exported', (): void => {
        expect(manifest).toHaveProperty(['exports', './schema.json'], './schema.json');
      });

      it('THEN schema.json is a published file', (): void => {
        const files: unknown = expect.arrayContaining(['schema.json']);

        expect(manifest).toHaveProperty(['files'], files);
      });

      it('THEN the turbo-atomizer bin points at cli.js', (): void => {
        expect(manifest).toHaveProperty(['bin', 'turbo-atomizer'], './cli.js');
      });

      it('THEN engines.node is >=24', (): void => {
        expect(manifest).toHaveProperty(['engines', 'node'], '>=24');
      });

      it('THEN no catalog specifier is left', (): void => {
        const specifiers = catalogSpecifiers(manifest);

        expect(specifiers).toEqual([]);
      });

      it('THEN every export and bin target exists in the output dir', (): void => {
        const exported = exportTargets(manifest);
        const bins = binTargets(manifest);
        const targets = [...exported, ...bins];

        const missing = targets.filter((target): boolean => !existsSync(join(outDir, target)));

        expect(missing).toEqual([]);
      });

      it('THEN every require and .cjs export target loads with require() in node', async (): Promise<void> => {
        const targets = requireTargets(manifest);
        const paths = targets.map((target): string => join(outDir, target));

        const { stderr } = await execFileAsync(
          process.execPath,
          ['--no-experimental-require-module', '-e', REQUIRE_SCRIPT, ...paths],
          { cwd: outDir }
        );

        expect(targets).not.toEqual([]);
        expect(stderr).toBe('');
      });

      it('THEN every import and default .js export target loads with import() in node', async (): Promise<void> => {
        const targets = importTargets(manifest);
        const urls = targets.map((target): string => pathToFileURL(join(outDir, target)).href);

        const { stderr } = await execFileAsync(process.execPath, ['--input-type=module', '-e', IMPORT_SCRIPT, ...urls]);

        expect(targets).not.toEqual([]);
        expect(stderr).toBe('');
      });
    });

    describe('WHEN cli.js runs with its runtime dependencies installed next to it', (): void => {
      it('THEN --version prints the manifest version', async (): Promise<void> => {
        const manifest = readJsonFile<PackageManifest>(join(outDir, 'package.json'));
        const cliPath = join(outDir, 'cli.js');

        const { stdout } = await execFileAsync(process.execPath, [cliPath, '--version']);

        expect(stdout).toBe(`${manifest.version}\n`);
      });

      it('THEN --help prints the usage', async (): Promise<void> => {
        const cliPath = join(outDir, 'cli.js');

        const { stdout } = await execFileAsync(process.execPath, [cliPath, '--help']);

        expect(stdout).toContain('merge-reports');
      });
    });

    it('WHEN the output dir is listed THEN every entry file exists', async (): Promise<void> => {
      const files = await readdir(outDir);

      expect(files).toEqual(expect.arrayContaining(ENTRY_FILES));
    });

    it('WHEN schema.json is read THEN it describes the task field', async (): Promise<void> => {
      const text = await readFile(join(outDir, 'schema.json'), 'utf8');
      const schema: unknown = JSON.parse(text);

      expect(schema).toHaveProperty(['properties', 'task', 'type'], 'string');
    });

    it('WHEN cli.js is read THEN it starts with a node shebang', async (): Promise<void> => {
      const cli = await readFile(join(outDir, 'cli.js'), 'utf8');

      expect(cli.startsWith('#!/usr/bin/env node\n')).toBe(true);
    });
  });
});
