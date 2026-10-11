import { join } from 'node:path';

import { getAtomizerEnv } from './config/atomizer-env.schema.ts';
import type { ExecDeps } from './exec/common/exec.type.ts';
import { runExec } from './exec/domain-logic/exec.ts';
import type { ServerLease } from './shared/server/common/server-lease.type.ts';

const noServer: ServerLease = { env: {}, release: (): void => undefined };

const ensureServer = async (): Promise<ServerLease> => Promise.resolve(noServer);

const setExitCode = (code: number): void => {
  process.exitCode = code;
};

const failExec = (error: unknown): void => {
  process.stderr.write(`turbo-atomizer exec: ${String(error)}\n`);
  process.exitCode = 1;
};

const startExec = async (): Promise<number> => {
  const env = getAtomizerEnv();
  const deps: ExecDeps = { ensureServer, countReporterPath: join(__dirname, 'count-reporter.cjs'), atomizerArgs: env.args };

  return runExec(process.argv.slice(1), process.cwd(), deps);
};

startExec().then(setExitCode, failExec);
