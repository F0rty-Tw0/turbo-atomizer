import type { SignalNumbers } from '../common/exec.type.ts';

export const toExitCode = (code: number | null, signal: NodeJS.Signals | null, signalNumbers: SignalNumbers): number => {
  if (code !== null) return code;

  if (signal === null) return 1;

  const signalNumber = signalNumbers[signal];

  if (signalNumber === undefined) return 1;

  return 128 + signalNumber;
};
