import { execFileSync, spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { ReleaseScenario } from '../common/release-scenario.type.ts';

/**
 * A temp workspace with the repository's real `nx.json`, an unreleased `turbo-atomizer` at 0.0.0,
 * and an empty git repository: no commits, because agents may not commit (commit-guard).
 */
export const createReleaseScenario = (): ReleaseScenario => {
  const repository = resolve(import.meta.dirname, '../../../..');
  const fixture = resolve(import.meta.dirname, '../fixtures/release-workspace');
  const script = join(repository, 'tools/src/release.ts');
  const root = mkdtempSync(join(tmpdir(), 'nx-release-scenario-'));
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  const scenarioEnv = Object.fromEntries([
    ['CI', 'true'],
    ['GITHUB_OUTPUT', ''],
    ['NX_DAEMON', 'false'],
    ['NX_NO_CLOUD', 'true'],
    ['NX_TUI', 'false']
  ]);
  const env = { ...process.env, ...scenarioEnv };

  cpSync(fixture, root, { recursive: true });
  copyFileSync(join(repository, 'nx.json'), join(root, 'nx.json'));
  symlinkSync(join(repository, 'node_modules'), join(root, 'node_modules'), linkType);
  execFileSync('git', ['init', '--quiet'], { cwd: root });

  const run = (...args: string[]): SpawnSyncReturns<string> => {
    return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', env, timeout: 120_000 });
  };
  const version = (): string => {
    const text = readFileSync(join(root, 'packages/turbo-atomizer/package.json'), 'utf8');
    const manifest: unknown = JSON.parse(text);
    const hasVersion = typeof manifest === 'object' && manifest !== null && 'version' in manifest;

    if (!hasVersion) return '';

    return String(manifest.version);
  };
  const dispose = (): void => rmSync(root, { force: true, recursive: true });
  const scenario: ReleaseScenario = { dispose, run, version };

  return scenario;
};
