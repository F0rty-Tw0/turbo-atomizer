import type { SignalNumbers } from '../../exec/common/exec.type.ts';
import { toExitCode } from '../../exec/utils/exit-code.util.ts';
import type { TurboExit } from '../../shared/turbo/common/turbo-run.type.ts';

/** turbo exits 0 after a forwarded Ctrl+C, so a forwarded signal decides the exit code before turbo's own code. */
export const toTurboExitCode = (exit: TurboExit, signalNumbers: SignalNumbers): number => {
  if (exit.interrupt !== null) return toExitCode(null, exit.interrupt, signalNumbers);

  return toExitCode(exit.code, exit.signal, signalNumbers);
};
