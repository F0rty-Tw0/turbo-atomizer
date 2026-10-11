import { join } from 'node:path';

import { getAtomizerEnv } from './config/atomizer-env.schema.ts';
import type { ExecDeps } from './exec/common/exec.type.ts';
import { runExec } from './exec/domain-logic/exec.ts';
import { ensureServer } from './server/domain-logic/server-lease.ts';
import type { ServerLease } from './shared/server/common/server-lease.type.ts';

const supervisorPath = join(__dirname, 'supervisor.js');

const leaseServer = async (packageDir: string, configFile: string): Promise<ServerLease> =>
  ensureServer(packageDir, configFile, supervisorPath);

const setExitCode = (code: number): void => {
  process.exitCode = code;
};

const failExec = (error: unknown): void => {
  process.stderr.write(`turbo-atomizer exec: ${String(error)}\n`);
  process.exitCode = 1;
};

const startExec = async (): Promise<number> => {
  const env = getAtomizerEnv();
  const deps: ExecDeps = {
    ensureServer: leaseServer,
    countReporterPath: join(__dirname, 'count-reporter.cjs'),
    atomizerArgs: env.args
  };

  return runExec(process.argv.slice(1), process.cwd(), deps);
};

startExec().then(setExitCode, failExec);
