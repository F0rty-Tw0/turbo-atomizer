import { spawn } from 'node:child_process';

import { resolvePlaywrightBin } from '../../shared/playwright/data-access/playwright-bin.path.ts';
import type { PlaywrightExit, PlaywrightTestRun } from '../common/exec.type.ts';

const FORWARDED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

/** Runs `<bin> <args>` with inherited stdio and forwards SIGINT and SIGTERM to it until it exits. */
export const runPlaywrightTest = async (run: PlaywrightTestRun): Promise<PlaywrightExit> => {
  const bin = resolvePlaywrightBin(run.cwd);
  const args = [bin, ...run.args];

  return new Promise((resolve, reject): void => {
    const child = spawn(process.execPath, args, { cwd: run.cwd, env: run.env, stdio: 'inherit' });

    const forward = (signal: NodeJS.Signals): void => {
      child.kill(signal);
    };

    const stopForwarding = (): void => {
      for (const signal of FORWARDED_SIGNALS) process.off(signal, forward);
    };

    const settle = (code: number | null, signal: NodeJS.Signals | null): void => {
      const exit: PlaywrightExit = { code, signal };

      stopForwarding();
      resolve(exit);
    };

    const fail = (error: Error): void => {
      stopForwarding();
      reject(error);
    };

    for (const signal of FORWARDED_SIGNALS) process.on(signal, forward);

    child.on('error', fail);
    child.on('close', settle);
  });
};
