import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { assertFreshAtomizerBuild } from './atomizer-build.spec.util.ts';
import { e2eEnv } from './e2e-env.spec.util.ts';
import { fillPorts } from './fixture-ports.spec.util.ts';
import { dryRunTasks, taskHashesOf } from './turbo-summary.spec.util.ts';
import { quotedPath, runChecked, runCommand } from './workspace-command.spec.util.ts';
import { settleWorkspaceProcesses } from './workspace-processes.spec.util.ts';
import {
  ATOMIZER_PACKAGE,
  FIXTURE_BASES,
  INSTALL_COMMANDS,
  PNPM_WORKSPACE_FILE,
  PROCESS_SETTLE_MS
} from '../common/fixture-workspace.const.ts';
import type {
  CommandEnv,
  FixtureName,
  FixtureWorkspace,
  PackageManager,
  RunResult,
  TaskHashes
} from '../common/fixture-workspace.type.ts';
import { npmPackSchema, rootManifestSchema } from '../common/turbo-summary.schema.ts';

const FIXTURES_DIR = join(import.meta.dirname, '..', 'fixtures');

const ATOMIZER_DIST = join(import.meta.dirname, '..', '..', '..', '..', '..', 'dist', 'packages', 'turbo-atomizer');

// Windows can hold a file briefly after its process exits
const RM_RETRIES = 5;

const RM_RETRY_DELAY_MS = 200;

/** Packs the built package into `root` and returns the tarball's file name. */
const packAtomizer = async (root: string): Promise<string> => {
  await assertFreshAtomizerBuild(ATOMIZER_DIST);

  const result = await runChecked(root, `npm pack ${quotedPath(ATOMIZER_DIST)} --pack-destination . --json`);
  const raw: unknown = JSON.parse(result.stdout);
  const [packed] = npmPackSchema.parse(raw);

  if (packed === undefined) throw new Error(`npm pack wrote no tarball for ${ATOMIZER_DIST}`);

  return packed.filename;
};

/** Adds the packed package as a root devDependency, and swaps in `ATOMIZER_E2E_TURBO_VERSION` for turbo when it is set. */
const addAtomizerDependency = async (root: string, tarball: string): Promise<void> => {
  const manifestPath = join(root, 'package.json');
  const text = await readFile(manifestPath, 'utf8');
  const raw: unknown = JSON.parse(text);
  const manifest = rootManifestSchema.parse(raw);
  const { turboVersion } = e2eEnv();
  const devDependencies: Record<string, string> = { ...manifest.devDependencies, [ATOMIZER_PACKAGE]: `file:${tarball}` };

  if (turboVersion !== undefined) devDependencies['turbo'] = turboVersion;

  const updated = { ...manifest, devDependencies };

  await writeFile(manifestPath, `${JSON.stringify(updated, null, 2)}\n`);
};

const commitAll = async (root: string, message: string): Promise<void> => {
  await runChecked(root, `git add --all && git commit --quiet --allow-empty --message ${JSON.stringify(message)}`);
};

/** Copies the fixture's base fixture first, if it has one, then the fixture's own files over it. */
const copyFixture = async (root: string, name: FixtureName, pm: PackageManager): Promise<void> => {
  const base = FIXTURE_BASES[name];

  if (base !== undefined) await cp(join(FIXTURES_DIR, base), root, { recursive: true });

  await cp(join(FIXTURES_DIR, name), root, { recursive: true });

  // an npm workspace lists its packages in package.json
  if (pm === 'npm') await rm(join(root, PNPM_WORKSPACE_FILE), { force: true });
};

/** Copies the fixture, packs and installs the built package as a root devDependency, and commits everything. */
const prepareWorkspace = async (root: string, name: FixtureName, pm: PackageManager): Promise<void> => {
  await copyFixture(root, name, pm);
  await fillPorts(root);

  const tarball = await packAtomizer(root);

  await addAtomizerDependency(root, tarball);
  await runChecked(root, INSTALL_COMMANDS[pm]);
  await runChecked(root, 'git init --quiet --initial-branch=main');
  await commitAll(root, 'fixture');
};

const workspaceAt = (root: string): FixtureWorkspace => {
  const at = (path: string): string => join(root, path);
  const run = async (command: string, env?: CommandEnv): Promise<RunResult> => runCommand(root, command, env);
  const read = async (path: string): Promise<string> => readFile(at(path), 'utf8');
  const remove = async (path: string): Promise<void> => rm(at(path), { force: true, recursive: true });
  const commit = async (message: string): Promise<void> => commitAll(root, message);

  const edit = async (path: string, text: string): Promise<void> => {
    await mkdir(dirname(at(path)), { recursive: true });
    await writeFile(at(path), text);
  };

  const taskHashes = async (): Promise<TaskHashes> => {
    const tasks = await dryRunTasks(root, 'e2e-ci');

    return taskHashesOf(tasks);
  };

  const dispose = async (): Promise<void> => {
    await settleWorkspaceProcesses(root, PROCESS_SETTLE_MS);
    await rm(root, { force: true, recursive: true, maxRetries: RM_RETRIES, retryDelay: RM_RETRY_DELAY_MS });
  };

  const workspace: FixtureWorkspace = { root, run, read, edit, remove, commit, taskHashes, dispose };

  return workspace;
};

/** Makes a fresh dir under `os.tmpdir()`, runs `prepare` in it, and disposes the dir when `prepare` throws. */
export const createWorkspace = async (prefix: string, prepare: (root: string) => Promise<void>): Promise<FixtureWorkspace> => {
  const root = await mkdtemp(join(tmpdir(), `ta-e2e-${prefix}-`));
  const workspace = workspaceAt(root);

  try {
    await prepare(root);
  } catch (error) {
    await workspace.dispose();

    throw error;
  }

  return workspace;
};

/**
 * Copies fixture `name` to a fresh dir under `os.tmpdir()`, named after `label`, and makes it a consumer repo before
 * `turbo-atomizer init`: the built package installed from a tarball, every file committed on `main`. Turbo hashes
 * git-ignored files until a repo's first commit.
 */
export const createFixtureWorkspace = async (
  name: FixtureName,
  pm: PackageManager,
  label: string = name
): Promise<FixtureWorkspace> => {
  const prepare = async (root: string): Promise<void> => prepareWorkspace(root, name, pm);

  return createWorkspace(label, prepare);
};
