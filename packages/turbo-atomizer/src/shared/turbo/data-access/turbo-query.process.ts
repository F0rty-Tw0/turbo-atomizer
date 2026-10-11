import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { z } from 'zod';

import { toStderrTail } from '../../playwright/utils/playwright-list-mapper.util.ts';
import { TurboQueryException } from '../common/turbo-query.exception.ts';
import { fileDepsResultSchema, packageTasksResultSchema } from '../common/turbo-query.schema.ts';
import type { PackageTasks } from '../common/turbo-query.type.ts';

type TurboQueryRun = {
  readonly bin: string;
  readonly query: string;
  readonly root: string;
};

type DependencyPackage = {
  readonly name: string;
  readonly path: string;
  readonly tasks: TaskItems;
};

type TaskItems = {
  readonly items: TaskItem[];
};

type TaskItem = {
  readonly name: string;
};

const binManifestSchema = z.looseObject({
  bin: z.looseObject({ turbo: z.string() })
});

const ROOT_PACKAGE_NAME = '//';

const resolveTurboBin = (root: string): string => {
  const require = createRequire(import.meta.url);
  const paths = [root];
  const manifestPath = require.resolve('turbo/package.json', { paths });
  const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = binManifestSchema.parse(raw);

  return join(dirname(manifestPath), manifest.bin.turbo);
};

const runQuery = async (run: TurboQueryRun): Promise<string> => {
  return new Promise((resolve, reject): void => {
    const child = spawn(process.execPath, [run.bin, 'query', run.query], { cwd: run.root, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const settle = (code: number | null): void => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');

      if (code === 0) return void resolve(stdout);

      reject(new TurboQueryException(`exit code ${String(code)} in ${run.root}`, toStderrTail(stderr)));
    };

    child.stdout.on('data', (chunk: Buffer): number => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer): number => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('close', settle);
  });
};

const queryTurbo = async (root: string, query: string): Promise<unknown> => {
  const bin = resolveTurboBin(root);
  const run: TurboQueryRun = { bin, query, root };
  const stdout = await runQuery(run);
  const result: unknown = JSON.parse(stdout);

  return result;
};

const isWorkspaceFile = (path: string): boolean => !path.split('/').includes('node_modules');

const isWorkspacePackage = (dependency: DependencyPackage): boolean => dependency.name !== ROOT_PACKAGE_NAME;

const taskName = (task: TaskItem): string => task.name;

const toPackageTasks = (dependency: DependencyPackage): PackageTasks => {
  const tasks = dependency.tasks.items.map(taskName);
  const packageTasks: PackageTasks = { name: dependency.name, dir: dependency.path, tasks };

  return packageTasks;
};

/**
 * Files `file` imports, transitively, as posix paths relative to `root`; `file` is relative to `root` too.
 * `node_modules` files are dropped. Unresolvable imports are skipped: turbo exits 0 for them.
 */
export const turboQueryFileDeps = async (root: string, file: string): Promise<string[]> => {
  const path = JSON.stringify(file);
  const query = `{ file(path: ${path}) { dependencies(emitErrors: false) { files { items { path } } } } }`;
  const raw = await queryTurbo(root, query);
  const result = fileDepsResultSchema.parse(raw);
  const paths = result.data.file.dependencies.files.items.map((item): string => item.path);

  return paths.filter(isWorkspaceFile);
};

/** The direct workspace dependencies of `packageName` with their task names; the root package `//` is dropped. */
export const turboQueryPackageTasks = async (root: string, packageName: string): Promise<PackageTasks[]> => {
  const name = JSON.stringify(packageName);
  const query = `{ package(name: ${name}) { directDependencies { items { name path tasks { items { name } } } } } }`;
  const raw = await queryTurbo(root, query);
  const result = packageTasksResultSchema.parse(raw);
  const dependencies = result.data.package.directDependencies.items.filter(isWorkspacePackage);

  return dependencies.map(toPackageTasks);
};
