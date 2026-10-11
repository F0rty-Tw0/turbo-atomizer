import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { readJsonFile } from '@nx/devkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildPackage } from './build-package.ts';
import type { PackageManifest } from './common/build-package.type.ts';

const execFileAsync = promisify(execFile);

const packageRoot = resolve(import.meta.dirname, '../../packages/turbo-atomizer');

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
    });

    afterAll(async (): Promise<void> => {
      await rm(outDir, { force: true, recursive: true });
    });

    describe('WHEN the published manifest is read', (): void => {
      let manifest: unknown;

      beforeAll(async (): Promise<void> => {
        const text = await readFile(join(outDir, 'package.json'), 'utf8');

        manifest = JSON.parse(text);
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
        const versionRange: unknown = expect.not.stringMatching(/^catalog:/);

        expect(manifest).toHaveProperty(['dependencies', 'zod'], versionRange);
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

    describe('WHEN cli.js runs with its runtime dependencies installed next to it', (): void => {
      beforeAll(async (): Promise<void> => {
        await symlink(join(packageRoot, 'node_modules'), join(outDir, 'node_modules'), 'junction');
      });

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
  });
});
