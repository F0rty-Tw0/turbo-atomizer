import { execFileSync } from 'node:child_process';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { vi } from 'vitest';

import { copyTurboFixture } from './turbo-fixture.spec.util.ts';
import type { FixtureCopy } from '../../../../test/common/fixture-copy.type.ts';

const GIT_IDENTITY = ['-c', 'user.name=turbo-atomizer', '-c', 'user.email=test@turbo-atomizer.invalid', '-c', 'commit.gpgsign=false'];

const isGithubKey = (key: string): boolean => key.startsWith('GITHUB_');

const installedTurboDir = (): string => {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve('turbo/package.json');

  return dirname(manifestPath);
};

/**
 * Copies the `query-workspace` fixture to a temp dir and adds the `node_modules` git cannot hold:
 * a link to the installed turbo, so the copy runs it like a consumer root does, and a `dep` package the spec imports.
 */
export const copyQueryWorkspace = async (): Promise<FixtureCopy> => {
  const copy = await copyTurboFixture('query-workspace');
  const nodeModules = join(copy.directory, 'node_modules');
  const depDir = join(nodeModules, 'dep');
  const turboDir = installedTurboDir();

  await mkdir(depDir, { recursive: true });
  await symlink(turboDir, join(nodeModules, 'turbo'), 'junction');
  await writeFile(join(depDir, 'package.json'), '{ "name": "dep", "version": "1.0.0", "main": "index.js" }\n');
  await writeFile(join(depDir, 'index.js'), 'exports.dep = 1;\n');

  return copy;
};

/**
 * Points turbo's affected base at `HEAD` and hides the runner's `GITHUB_*` (undo with `vi.unstubAllEnvs`): on a GitHub Actions
 * push or pull request, turbo takes the base from the event, ignores `TURBO_SCM_BASE`, cannot find that commit in the fixture
 * repo and treats every file as changed.
 */
export const stubLocalScmBase = (): void => {
  const githubKeys = Object.keys(process.env).filter(isGithubKey);

  vi.stubEnv('TURBO_SCM_BASE', 'HEAD');
  githubKeys.forEach((key): void => {
    vi.stubEnv(key, undefined);
  });
};

/** Makes the copy a git repo with one commit, so `turbo query affectedTasks` sees only edits made afterwards. */
export const commitQueryWorkspace = async (copy: FixtureCopy): Promise<void> => {
  const git = (args: string[]): Buffer => execFileSync('git', [...GIT_IDENTITY, ...args], { cwd: copy.directory, stdio: 'pipe' });

  await writeFile(join(copy.directory, '.gitignore'), 'node_modules\n');
  git(['init', '--quiet']);
  git(['add', '--all']);
  git(['commit', '--quiet', '--message', 'fixture']);
};
