import { spawn } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { GIT_ENV, QUIET_ENV } from '../common/fixture-workspace.const.ts';
import type { CommandEnv, RunResult } from '../common/fixture-workspace.type.ts';

/** Outer `TURBO_*` settings (remote cache, SCM base) and `FORCE_COLOR`, which would colour the output the specs read. */
const isDroppedKey = (key: string): boolean => key.startsWith('TURBO_') || key === 'FORCE_COLOR';

const definedEntries = (env: NodeJS.ProcessEnv): [string, string][] => {
  const entries: [string, string][] = [];

  for (const [key, value] of Object.entries(env)) {
    const isDropped = isDroppedKey(key);
    const isKept = value !== undefined && !isDropped;

    if (isKept) entries.push([key, value]);
  }

  return entries;
};

const isPathKey = (key: string): boolean => key.toUpperCase() === 'PATH';

/** The vitest env minus the dropped keys, plus the workspace bins first on PATH. */
const commandEnv = (root: string, overrides: CommandEnv): CommandEnv => {
  const inherited = Object.fromEntries(definedEntries(process.env));
  // Windows spells it `Path`; a second `PATH` key would leave the child with either one
  const pathKey = Object.keys(inherited).find(isPathKey) ?? 'PATH';
  const outerPath = inherited[pathKey] ?? '';
  const binDir = join(root, 'node_modules', '.bin');
  const path = `${binDir}${delimiter}${outerPath}`;
  const env: CommandEnv = { ...inherited, ...QUIET_ENV, ...GIT_ENV, [pathKey]: path, ...overrides };

  return env;
};

/** Runs `command` through a shell in `root` and collects its output; never rejects on a non-zero exit. */
export const runCommand = async (root: string, command: string, overrides: CommandEnv = {}): Promise<RunResult> => {
  const env = commandEnv(root, overrides);
  const startedAt = performance.now();

  return new Promise((resolve, reject): void => {
    const child = spawn(command, { cwd: root, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const settle = (code: number | null): void => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      const durationMs = Math.round(performance.now() - startedAt);
      const result: RunResult = { exitCode: code ?? 1, stdout, stderr, durationMs };

      resolve(result);
    };

    child.stdout.on('data', (chunk: Buffer): number => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer): number => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('close', settle);
  });
};

/** `path` in double quotes for the shell; backslashes stay as they are, which Windows paths need. */
export const quotedPath = (path: string): string => `"${path}"`;

/** Everything a command printed, for assertion messages that explain a failed run. */
export const outputOf = (result: RunResult): string => `${result.stdout}${result.stderr}`;

/** Runs `command` like `runCommand` and throws with its output when it exits non-zero. */
export const runChecked = async (root: string, command: string): Promise<RunResult> => {
  const result = await runCommand(root, command);

  if (result.exitCode === 0) return result;

  throw new Error(`\`${command}\` exited ${String(result.exitCode)} in ${root}\n${result.stdout}\n${result.stderr}`);
};
