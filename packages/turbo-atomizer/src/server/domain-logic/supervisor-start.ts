import type { SupervisorStart } from '../common/server.type.ts';
import { appendServerLog, spawnSupervisor } from '../data-access/supervisor.process.ts';
import { launchOutsideJob } from '../data-access/windows-launch.process.ts';
import { toSupervisorLaunch } from '../utils/windows-launch.util.ts';

const isWindows = process.platform === 'win32';

/**
 * Spec §7 Start step 1. POSIX: spawns the supervisor detached. Windows: turbo runs each task in a kill-on-close job that a
 * detached child stays in, so WMI starts the supervisor entry with `--spawn` outside it, and that launcher spawns the
 * supervisor detached and exits. The launch time goes to `.atomizer/server.log`.
 */
export const startSupervisor = async (supervisorPath: string, packageDir: string, configFile: string): Promise<void> => {
  if (!isWindows) return spawnSupervisor(supervisorPath, packageDir, configFile);

  const start: SupervisorStart = { execPath: process.execPath, supervisorPath, packageDir, configFile };
  const launch = toSupervisorLaunch(start, process.env);
  const startedAt = Date.now();
  const pid = await launchOutsideJob(launch);
  const elapsedMs = Date.now() - startedAt;

  await appendServerLog(
    packageDir,
    `[turbo-atomizer] launcher ${String(pid)} started outside turbo's job in ${String(elapsedMs)} ms\n`
  );
};
