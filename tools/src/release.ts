import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

import { ReleaseClient } from 'nx/release';

import type { ReleaseBump, ReleaseCommand } from './common/release.type.ts';

const PROJECT = 'turbo-atomizer';

const USAGE = 'Usage: node tools/src/release.ts <plan|prepare> [patch|minor|major]';

const git = (...args: string[]): string => {
  const output = execFileSync('git', args, { encoding: 'utf8' });

  return output.trim();
};

const readCommand = (value: string | undefined): ReleaseCommand => {
  if (value === 'plan' || value === 'prepare') return value;

  throw new Error(USAGE);
};

const readBump = (value: string | undefined): ReleaseBump => {
  if (value === undefined) return 'patch';

  if (value === 'patch' || value === 'minor' || value === 'major') return value;

  throw new Error('Expected patch, minor, or major.');
};

const assertCleanCheckout = (): void => {
  const changes = git('status', '--porcelain');

  if (changes) throw new Error('Release preparation requires a clean checkout.');
};

/**
 * `plan` previews the next version without writing. `prepare` bumps the manifest, writes the
 * project CHANGELOG.md, commits, and tags `v{version}` locally; the workflow pushes and publishes.
 * The first release (no `v*` tag yet) bumps from the on-disk version.
 */
const runRelease = async (command: ReleaseCommand, bump: ReleaseBump): Promise<void> => {
  const dryRun = command === 'plan';
  const releaseTags = git('tag', '--list', 'v*');
  const firstRelease = releaseTags === '';
  const client = new ReleaseClient({});

  if (!dryRun) assertCleanCheckout();

  const versionResult = await client.releaseVersion({
    deleteVersionPlans: false,
    dryRun,
    firstRelease,
    gitCommit: false,
    gitPush: false,
    gitTag: false,
    projects: [PROJECT],
    specifier: bump,
    stageChanges: true
  });
  const versionData = versionResult.projectsVersionData;
  const nextVersion = versionData[PROJECT]?.newVersion ?? 'none';

  process.stdout.write(`Project: ${PROJECT}\nNext version: ${nextVersion}\n`);

  if (dryRun) return;

  await client.releaseChangelog({
    createRelease: false,
    firstRelease,
    gitCommit: true,
    gitPush: false,
    gitTag: true,
    projects: [PROJECT],
    stageChanges: false,
    versionData
  });

  const output = process.env['GITHUB_OUTPUT'];

  if (output) appendFileSync(output, `version=${nextVersion}\n`);
};

const run = async (): Promise<void> => {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs.filter((argument: string): boolean => argument !== '--');
  const [commandArg, bumpArg, ...extra] = args;

  if (extra.length > 0) throw new Error('Too many release arguments.');

  const command = readCommand(commandArg);
  const bump = readBump(bumpArg);

  await runRelease(command, bump);
};

await run();
