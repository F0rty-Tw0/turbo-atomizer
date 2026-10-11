import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { POWERSHELL_EXE } from '../../common/windows-launch.const.ts';

type PowerShellStub = {
  readonly dir: string;
  readonly restore: () => Promise<void>;
};

/** Puts an executable `powershell.exe` running the sh `body` first on PATH (POSIX only); `restore` puts PATH back. */
export const installPowerShellStub = async (body: string): Promise<PowerShellStub> => {
  const dir = await mkdtemp(join(tmpdir(), 'ta-powershell-stub-'));
  const stubPath = join(dir, POWERSHELL_EXE);
  const previousPath = process.env['PATH'];

  await writeFile(stubPath, `#!/bin/sh\n${body}\n`);
  await chmod(stubPath, 0o755);
  process.env['PATH'] = `${dir}${delimiter}${previousPath ?? ''}`;

  const restore = async (): Promise<void> => {
    process.env['PATH'] = previousPath;
    await rm(dir, { recursive: true, force: true });
  };
  const stub: PowerShellStub = { dir, restore };

  return stub;
};
