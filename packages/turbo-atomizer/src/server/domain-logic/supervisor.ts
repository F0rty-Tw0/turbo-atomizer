import { resolve } from 'node:path';
import type { Writable } from 'node:stream';

import { claimRendezvous, ownRendezvousPath, ownRendezvousToken, preparePrivateDir, releaseRendezvous } from './rendezvous.ts';
import { SupervisorLoop } from './supervisor-loop.ts';
import { DEFAULT_SERVER_IDLE_MS } from '../../shared/atomizer/common/atomizer.const.ts';
import { loadAtomizerConfig } from '../../shared/config/domain-logic/atomizer-config.ts';
import type { SupervisorLoopOptions } from '../common/server.type.ts';
import { rotateServerLog } from '../data-access/supervisor.process.ts';

type SupervisorSettings = Pick<SupervisorLoopOptions, 'idleMs' | 'startupFailure'>;

/** An invalid atomizer config still gets a supervisor, so every waiting exec hears the failure instead of timing out. */
const loadSettings = async (packageDir: string): Promise<SupervisorSettings> => {
  try {
    const { config } = await loadAtomizerConfig(packageDir);
    const settings: SupervisorSettings = { idleMs: config.server.idleMs, startupFailure: undefined };

    return settings;
  } catch (error) {
    const unknownFailure = String(error);
    const startupFailure = error instanceof Error ? error.message : unknownFailure;
    const settings: SupervisorSettings = { idleMs: DEFAULT_SERVER_IDLE_MS, startupFailure };

    return settings;
  }
};

/** The detached supervisor of spec §7: one per test package, sharing its web servers until it has been idle for `server.idleMs`. */
export const runSupervisor = async (packageDir: string, configFile: string, log: Writable): Promise<void> => {
  const root = resolve(packageDir);
  const socketPath = ownRendezvousPath(root);
  const settings = await loadSettings(root);

  await preparePrivateDir(socketPath);

  const token = ownRendezvousToken(socketPath);
  const options: SupervisorLoopOptions = { packageDir: root, configFile, log, token, ...settings };
  const loop = new SupervisorLoop(options);
  const server = await claimRendezvous(socketPath, loop.onConnection);

  if (server === undefined) {
    log.write(`[turbo-atomizer] supervisor ${String(process.pid)}: another supervisor owns ${socketPath}\n`);

    return;
  }

  await rotateServerLog(root);
  log.write(`[turbo-atomizer] supervisor ${String(process.pid)} listening on ${socketPath}\n`);
  loop.start();
  await loop.done;
  await releaseRendezvous(server, socketPath);
  log.write(`[turbo-atomizer] supervisor ${String(process.pid)} exited\n`);
};
