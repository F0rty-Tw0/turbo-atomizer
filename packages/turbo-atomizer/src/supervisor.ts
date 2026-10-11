import { SUPERVISOR_SPAWN_FLAG } from './server/common/server.const.ts';
import { spawnSupervisor } from './server/data-access/supervisor.process.ts';
import { runSupervisor } from './server/domain-logic/supervisor.ts';

const usage = 'Usage: supervisor [--spawn] <package dir> <playwright config file>\n';
const [entryPath, ...args] = process.argv.slice(1);
const isLauncher = args[0] === SUPERVISOR_SPAWN_FLAG;
const launcherArgs = args.slice(1);
const [packageDir, configFile] = isLauncher ? launcherArgs : args;

if (entryPath === undefined || packageDir === undefined || configFile === undefined) {
  process.stderr.write(usage);
  process.exitCode = 2;
} else if (isLauncher) {
  // Windows: WMI started this run outside turbo's task job; the supervisor spawned from here stays outside it too
  await spawnSupervisor(entryPath, packageDir, configFile);
} else {
  await runSupervisor(packageDir, configFile, process.stdout);
}
