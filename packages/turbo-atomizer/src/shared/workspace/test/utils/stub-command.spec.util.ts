import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { StubCommand } from '../common/workspace.type.ts';

/** Writes `name` (sh) and `name.cmd` (Windows) into a temp dir; each appends `<cwd> <args>` to `callsFile` and exits with `exitCode`. */
export const stubCommand = async (name: string, exitCode: number): Promise<StubCommand> => {
  const directory = await mkdtemp(join(tmpdir(), 'atomizer-stub-command-'));
  const callsFile = join(directory, 'calls.log');
  const shellScript = `#!/bin/sh\necho "$PWD $*" >> "${callsFile}"\nexit ${String(exitCode)}\n`;
  const cmdScript = `@echo %CD% %*>> "${callsFile}"\r\n@exit /b ${String(exitCode)}\r\n`;
  const shellPath = join(directory, name);
  const dispose = async (): Promise<void> => rm(directory, { force: true, recursive: true });

  await writeFile(shellPath, shellScript);
  await chmod(shellPath, 0o755);
  await writeFile(join(directory, `${name}.cmd`), cmdScript);

  const stub: StubCommand = { directory, callsFile, dispose };

  return stub;
};
