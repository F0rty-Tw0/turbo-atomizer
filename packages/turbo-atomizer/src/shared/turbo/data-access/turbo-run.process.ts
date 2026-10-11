import { spawn } from 'node:child_process';

import { resolveTurboBin } from './turbo-bin.path.ts';
import type { TurboExit } from '../common/turbo-run.type.ts';

const FORWARDED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

/** Runs `turbo run <args>` from the workspace root with inherited stdio and forwards SIGINT and SIGTERM until it exits. */
export const runTurbo = async (root: string, args: string[]): Promise<TurboExit> => {
  const bin = resolveTurboBin(root);
  const argv = [bin, 'run', ...args];

  return new Promise((resolve, reject): void => {
    const child = spawn(process.execPath, argv, { cwd: root, stdio: 'inherit' });
    let interrupt: NodeJS.Signals | null = null;

    const forward = (signal: NodeJS.Signals): void => {
      interrupt = signal;
      child.kill(signal);
    };

    const stopForwarding = (): void => {
      for (const signal of FORWARDED_SIGNALS) process.off(signal, forward);
    };

    const settle = (code: number | null, signal: NodeJS.Signals | null): void => {
      const exit: TurboExit = { code, interrupt, signal };

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
