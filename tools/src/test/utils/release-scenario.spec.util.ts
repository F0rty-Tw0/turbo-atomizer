import { execFileSync, spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { ReleaseScenario } from '../common/release-scenario.type.ts';

type Git = (...args: string[]) => string;

const CHANGELOG = 'packages/turbo-atomizer/CHANGELOG.md';

const FEATURE_FILE = 'packages/turbo-atomizer/feature.js';

const repository = resolve(import.meta.dirname, '../../../..');

const gitIn = (workspace: string): Git => {
  return (...args: string[]): string => {
    const output = execFileSync('git', args, { cwd: workspace, encoding: 'utf8' });

    return output.trim();
  };
};

/** The fixture plus the repository's real `nx.json` and `CHANGELOG.md`, committed with signing off. */
const createWorkspace = (workspace: string, git: Git): void => {
  const fixture = resolve(import.meta.dirname, '../fixtures/release-workspace');
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';

  cpSync(fixture, workspace, { recursive: true });
  copyFileSync(join(repository, 'nx.json'), join(workspace, 'nx.json'));
  copyFileSync(join(repository, CHANGELOG), join(workspace, CHANGELOG));
  symlinkSync(join(repository, 'node_modules'), join(workspace, 'node_modules'), linkType);
  git('init', '--quiet');
  git('config', 'user.name', 'Release Scenario');
  git('config', 'user.email', 'release-scenario@example.com');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  git('add', '--all');
  git('commit', '--quiet', '--message', 'chore: initial workspace');
};

const readVersion = (workspace: string): string => {
  const text = readFileSync(join(workspace, 'packages/turbo-atomizer/package.json'), 'utf8');
  const manifest: unknown = JSON.parse(text);
  const hasVersion = typeof manifest === 'object' && manifest !== null && 'version' in manifest;

  if (!hasVersion) return '';

  return String(manifest.version);
};

const readOutput = (outputFile: string): string => {
  const hasOutput = existsSync(outputFile);

  if (!hasOutput) return '';

  return readFileSync(outputFile, 'utf8');
};

/**
 * A temp workspace with an unreleased `turbo-atomizer` at 0.0.0 and a git repository with no
 * release tags whose last commit is a `feat:` in the package, so nx has a commit subject it could
 * write into a changelog. `GITHUB_OUTPUT` points outside the workspace, so the checkout stays clean.
 */
export const createReleaseScenario = (): ReleaseScenario => {
  const script = join(repository, 'tools/src/release.ts');
  const root = mkdtempSync(join(tmpdir(), 'nx-release-scenario-'));
  const workspace = join(root, 'workspace');
  const outputFile = join(root, 'github-output');
  const scenarioEnv = Object.fromEntries([
    ['CI', 'true'],
    ['GITHUB_OUTPUT', outputFile],
    ['NX_DAEMON', 'false'],
    ['NX_NO_CLOUD', 'true'],
    ['NX_TUI', 'false']
  ]);
  const env = { ...process.env, ...scenarioEnv };
  const git = gitIn(workspace);

  const commit = (subject: string): void => {
    appendFileSync(join(workspace, FEATURE_FILE), `// ${subject}\n`);
    git('add', FEATURE_FILE);
    git('commit', '--quiet', '--message', subject);
  };
  const run = (...args: string[]): SpawnSyncReturns<string> => {
    return spawnSync(process.execPath, [script, ...args], { cwd: workspace, encoding: 'utf8', env, timeout: 120_000 });
  };
  const changelog = (): string => readFileSync(join(workspace, CHANGELOG), 'utf8');
  const githubOutput = (): string => readOutput(outputFile);
  const tags = (): string[] => {
    const listing = git('tag', '--list');
    const lines = listing.split('\n');

    return lines.filter(Boolean);
  };
  const version = (): string => readVersion(workspace);
  const dispose = (): void => rmSync(root, { force: true, recursive: true });
  const scenario: ReleaseScenario = { changelog, commit, dispose, githubOutput, run, tags, version };

  createWorkspace(workspace, git);
  commit('feat: ship the scenario feature');

  return scenario;
};
