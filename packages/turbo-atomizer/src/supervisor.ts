import { runSupervisor } from './server/domain-logic/supervisor.ts';

const usage = 'Usage: supervisor <package dir> <playwright config file>\n';
const [packageDir, configFile] = process.argv.slice(2);

if (packageDir === undefined || configFile === undefined) {
  process.stderr.write(usage);
  process.exitCode = 2;
} else {
  await runSupervisor(packageDir, configFile, process.stdout);
}
