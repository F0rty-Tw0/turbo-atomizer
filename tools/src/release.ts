import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

import { ReleaseClient } from 'nx/release';

import type { ReleaseBump, ReleaseChangelogOptions, ReleaseCommand } from './common/release.type.ts';

const PROJECT = 'turbo-atomizer';

const CHANGELOG_PATH = 'packages/turbo-atomizer/CHANGELOG.md';

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

/** Dates the hand-written `## {version} (unreleased)` entry the way nx dates the entries it generates. */
const datedChangelog = (text: string, version: string): string => {
  const heading = `## ${version} (unreleased)\n`;
  const date = new Date().toISOString().slice(0, 10);
  const hasHeading = text.includes(heading);

  if (!hasHeading)
    throw new Error(
      `The first release ships the curated "${heading.trim()}" entry, but ${CHANGELOG_PATH} has none. Pick the bump that reaches the curated version.`
    );

  return text.replace(heading, `## ${version} (${date})\n`);
};

/** nx would replace the curated first entry with every commit subject since the repository began, so it is kept as written. */
const releaseCuratedEntry = (version: string, dryRun: boolean): void => {
  const text = readFileSync(CHANGELOG_PATH, 'utf8');
  const dated = datedChangelog(text, version);
  const tag = `v${version}`;

  process.stdout.write(`Changelog: curated ${version} entry in ${CHANGELOG_PATH}\n`);

  if (dryRun) return;

  writeFileSync(CHANGELOG_PATH, dated);
  git('add', CHANGELOG_PATH);
  git('commit', '--message', `chore(release): publish ${version}`);
  git('tag', '--annotate', tag, '--message', tag);
};

/**
 * `plan` previews the next version and changelog without writing. `prepare` bumps the manifest,
 * writes the project CHANGELOG.md, commits, and tags `v{version}` locally; the workflow pushes and
 * publishes. The first release (no `v*` tag yet) bumps from the on-disk version and ships the
 * curated entry; later releases generate theirs from the commits since the last tag.
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
  const changelogOptions: ReleaseChangelogOptions = {
    createRelease: false,
    dryRun,
    gitCommit: true,
    gitPush: false,
    gitTag: true,
    projects: [PROJECT],
    stageChanges: false,
    versionData
  };

  process.stdout.write(`Project: ${PROJECT}\nNext version: ${nextVersion}\n`);

  if (firstRelease) releaseCuratedEntry(nextVersion, dryRun);

  if (!firstRelease) await client.releaseChangelog(changelogOptions);

  const output = process.env['GITHUB_OUTPUT'];

  if (!dryRun && output) appendFileSync(output, `version=${nextVersion}\n`);
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
