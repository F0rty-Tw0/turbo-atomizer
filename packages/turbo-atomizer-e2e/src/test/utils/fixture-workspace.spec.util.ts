import type { Dirent } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { freePorts } from './free-port.spec.util.ts';
import { dryRunTasks, taskHashesOf } from './turbo-summary.spec.util.ts';
import { runChecked, runCommand } from './workspace-command.spec.util.ts';
import { settleWorkspaceProcesses } from './workspace-processes.spec.util.ts';
import {
  ATOMIZER_PACKAGE,
  INSTALL_COMMANDS,
  MAX_FIXTURE_PORTS,
  PORT_PLACEHOLDER,
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

const isFile = (entry: Dirent): boolean => entry.isFile();

const entryPath = (entry: Dirent): string => join(entry.parentPath, entry.name);

const fillFilePorts = async (file: string, ports: number[]): Promise<void> => {
  const text = await readFile(file, 'utf8');

  const portFor = (placeholder: string, index: string): string => {
    const port = ports[Number(index) - 1];

    if (port === undefined) return placeholder;

    return String(port);
  };

  const filled = text.replaceAll(PORT_PLACEHOLDER, portFor);

  if (filled !== text) await writeFile(file, filled);
};

/** Replaces every port placeholder in the copied fixture with a port the OS just handed out. */
const fillPorts = async (root: string): Promise<void> => {
  const ports = await freePorts(MAX_FIXTURE_PORTS);
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries.filter(isFile).map(entryPath);

  await Promise.all(files.map(async (file): Promise<void> => fillFilePorts(file, ports)));
};

/** Packs the built package into `root` and returns the tarball's file name. */
const packAtomizer = async (root: string): Promise<string> => {
  const result = await runChecked(root, `npm pack ${JSON.stringify(ATOMIZER_DIST)} --pack-destination . --json`);
  const raw: unknown = JSON.parse(result.stdout);
  const [packed] = npmPackSchema.parse(raw);

  if (packed === undefined) throw new Error(`npm pack wrote no tarball for ${ATOMIZER_DIST}`);

  return packed.filename;
};

const addAtomizerDependency = async (root: string, tarball: string): Promise<void> => {
  const manifestPath = join(root, 'package.json');
  const text = await readFile(manifestPath, 'utf8');
  const raw: unknown = JSON.parse(text);
  const manifest = rootManifestSchema.parse(raw);
  const devDependencies = { ...manifest.devDependencies, [ATOMIZER_PACKAGE]: `file:${tarball}` };
  const updated = { ...manifest, devDependencies };

  await writeFile(manifestPath, `${JSON.stringify(updated, null, 2)}\n`);
};

const commitAll = async (root: string, message: string): Promise<void> => {
  await runChecked(root, `git add --all && git commit --quiet --allow-empty --message ${JSON.stringify(message)}`);
};

/** Copies the fixture, packs and installs the built package as a root devDependency, and commits everything. */
const prepareWorkspace = async (root: string, name: FixtureName, pm: PackageManager): Promise<void> => {
  await cp(join(FIXTURES_DIR, name), root, { recursive: true });
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
    await rm(root, { force: true, recursive: true });
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
 * Copies fixture `name` to a fresh dir under `os.tmpdir()` and makes it a consumer repo before `turbo-atomizer init`:
 * the built package installed from a tarball, every file committed on `main`. Turbo hashes git-ignored files until a repo's first commit.
 */
export const createFixtureWorkspace = async (name: FixtureName, pm: PackageManager): Promise<FixtureWorkspace> => {
  const prepare = async (root: string): Promise<void> => prepareWorkspace(root, name, pm);

  return createWorkspace(name, prepare);
};
