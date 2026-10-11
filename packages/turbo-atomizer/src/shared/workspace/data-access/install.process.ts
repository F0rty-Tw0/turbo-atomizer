import { spawn } from 'node:child_process';
import { once } from 'node:events';

import { InstallFailedException } from '../common/install-failed.exception.ts';
import type { PackageManager } from '../common/workspace.type.ts';

/** Runs `<pm> install` in the workspace root so the lockfile includes the generated package (init step 10). */
export const runInstall = async (root: string, pm: PackageManager): Promise<void> => {
  const command = `${pm} install`;
  const isWindows = process.platform === 'win32';
  // Windows resolves pnpm.cmd / npm.cmd only through a shell.
  const child = spawn(pm, ['install'], { cwd: root, shell: isWindows, stdio: 'inherit' });

  try {
    await once(child, 'exit');
  } catch (error) {
    throw new InstallFailedException(command, null, { cause: error });
  }

  if (child.exitCode === 0) return;

  throw new InstallFailedException(command, child.exitCode);
};
