import { spawn } from 'node:child_process';
import type { StdioOptions } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';

import { ATOMIZER_OUTPUT_DIR } from '../../shared/atomizer/common/atomizer.const.ts';
import { SERVER_LOG_FILE } from '../common/server.const.ts';

/**
 * Starts `<supervisor entry> <package dir> <config file>` detached (spec §7 Start step 1). Its stdout and stderr append to
 * `.atomizer/server.log`; the dir is created first because no slug dir may exist yet.
 */
export const spawnSupervisor = async (supervisorPath: string, packageDir: string, configFile: string): Promise<void> => {
  const outputDir = join(packageDir, ATOMIZER_OUTPUT_DIR);

  await mkdir(outputDir, { recursive: true });

  const log = await open(join(outputDir, SERVER_LOG_FILE), 'a');

  try {
    const args = [supervisorPath, packageDir, configFile];
    const stdio: StdioOptions = ['ignore', log.fd, log.fd];
    const child = spawn(process.execPath, args, { cwd: packageDir, detached: true, stdio, windowsHide: true });

    child.unref();
  } finally {
    await log.close();
  }
};
