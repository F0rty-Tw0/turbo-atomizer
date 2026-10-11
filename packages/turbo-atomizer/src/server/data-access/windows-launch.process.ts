import { spawn } from 'node:child_process';

import { ServerFailedException } from '../common/server-failed.exception.ts';
import { LOG_TAIL_LINES } from '../common/server.const.ts';
import type { WindowsLaunch } from '../common/server.type.ts';
import {
  OUTSIDE_JOB_REASON,
  POWERSHELL_EXE,
  POWERSHELL_LAUNCH_ARGS,
  WINDOWS_LAUNCH_TIMEOUT_MS
} from '../common/windows-launch.const.ts';
import { win32CreateResultSchema } from '../common/windows-launch.schema.ts';
import { lastLines } from '../utils/log-tail.util.ts';
import { createdPid, toLaunchStdin } from '../utils/windows-launch.util.ts';

type PowerShellRun = {
  readonly exit: string;
  readonly stdout: string;
  readonly stderr: string;
};

const ignoreStdinError = (): void => undefined;

const describeExit = (code: number | null, signal: NodeJS.Signals | null): string => {
  if (code === null) return `was stopped by ${String(signal)}`;

  return `exited with code ${String(code)}`;
};

/**
 * Runs the launch script with `stdin` piped in, killing it after `timeoutMs`; resolves however it ends, rejects only when
 * powershell.exe cannot start.
 */
const runPowerShell = async (stdin: string, timeoutMs: number): Promise<PowerShellRun> => {
  return new Promise((resolve, reject): void => {
    const child = spawn(POWERSHELL_EXE, POWERSHELL_LAUNCH_ARGS, { windowsHide: true });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;

    const kill = (): void => {
      timedOut = true;
      child.kill();
    };
    const timer = setTimeout(kill, timeoutMs);

    const settle = (code: number | null, signal: NodeJS.Signals | null): void => {
      clearTimeout(timer);

      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      const timeout = `timed out after ${String(timeoutMs / 1000)} s`;
      const ended = describeExit(code, signal);
      const exit = timedOut ? timeout : ended;
      const run: PowerShellRun = { exit, stdout, stderr };

      resolve(run);
    };
    const fail = (error: Error): void => {
      clearTimeout(timer);
      reject(error);
    };

    child.stdout.on('data', (chunk: Buffer): number => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer): number => stderrChunks.push(chunk));
    child.stdin.on('error', ignoreStdinError);
    child.on('error', fail);
    child.on('close', settle);
    child.stdin.end(stdin);
  });
};

const unavailable = (error: unknown): never => {
  throw new ServerFailedException(
    `${OUTSIDE_JOB_REASON}: ${POWERSHELL_EXE}, which reaches WMI, could not start: ${String(error)}`,
    ''
  );
};

const parseResult = (run: PowerShellRun): number => {
  const stderrTail = lastLines(run.stderr, LOG_TAIL_LINES);

  try {
    const raw: unknown = JSON.parse(run.stdout);
    const result = win32CreateResultSchema.parse(raw);

    return createdPid(result);
  } catch (error) {
    if (error instanceof ServerFailedException) throw error;

    throw new ServerFailedException(
      `${OUTSIDE_JOB_REASON}: the WMI launch through ${POWERSHELL_EXE} ${run.exit} with no Win32_Process.Create result`,
      stderrTail
    );
  }
};

/**
 * Starts `launch` through WMI's `Win32_Process.Create`, so it runs outside the kill-on-close job turbo puts each task in,
 * and returns its pid. The env goes over stdin, never into a command line other processes can read. Windows only.
 */
export const launchOutsideJob = async (launch: WindowsLaunch, timeoutMs = WINDOWS_LAUNCH_TIMEOUT_MS): Promise<number> => {
  const stdin = toLaunchStdin(launch);
  const run = await runPowerShell(stdin, timeoutMs).catch(unavailable);

  return parseResult(run);
};
