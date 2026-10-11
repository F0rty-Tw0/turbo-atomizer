import type { Socket } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { ownRendezvousPath, ownRendezvousToken, preparePrivateDir, refuseForeignListener } from './rendezvous.ts';
import type { ServerLease } from '../../shared/server/common/server-lease.type.ts';
import { ServerFailedException } from '../common/server-failed.exception.ts';
import type { ServerMessage } from '../common/server-protocol.type.ts';
import {
  CLIENT_SILENCE_MS,
  LEASE_ATTEMPTS,
  SUPERVISOR_CONNECT_MS,
  SUPERVISOR_RESPAWN_MS,
  SUPERVISOR_SPAWNS
} from '../common/server.const.ts';
import { connectSocket, onVerifiedMessages } from '../data-access/rendezvous-client.socket.ts';
import { spawnSupervisor } from '../data-access/supervisor.process.ts';
import { nextProbeDelay } from '../utils/probe-schedule.util.ts';

const ignoreSocketError = (): void => undefined;

const tryConnect = async (socketPath: string): Promise<Socket | undefined> => {
  await refuseForeignListener(socketPath);

  return connectSocket(socketPath).catch((): undefined => undefined);
};

/** Spawns the supervisor again once `spawns * SUPERVISOR_RESPAWN_MS` has passed with no listener, up to `SUPERVISOR_SPAWNS` in all. */
const respawnWhenDue = async (spawn: () => Promise<void>, spawns: number, elapsedMs: number): Promise<number> => {
  const isDue = spawns < SUPERVISOR_SPAWNS && elapsedMs >= spawns * SUPERVISOR_RESPAWN_MS;

  if (!isDue) return spawns;

  await spawn();

  return spawns + 1;
};

/**
 * A spawned supervisor exits when it loses the lock to an old one that has closed its socket but not yet released the
 * lock, leaving no listener; so while none answers, the supervisor is spawned again.
 */
const connectWithBackoff = async (socketPath: string, spawn: () => Promise<void>): Promise<Socket> => {
  const startedAt = Date.now();
  const deadline = startedAt + SUPERVISOR_CONNECT_MS;
  let spawns = 1;

  for (let attempt = 0; Date.now() < deadline; attempt += 1) {
    await sleep(nextProbeDelay(attempt));

    const socket = await tryConnect(socketPath);

    if (socket !== undefined) return socket;

    spawns = await respawnWhenDue(spawn, spawns, Date.now() - startedAt);
  }

  throw new ServerFailedException(`no supervisor listened on ${socketPath} within 10 s; see .atomizer/server.log`, '');
};

/** Spec §7 Start step 1: connect, or spawn the supervisor and retry with backoff. */
const connectSupervisor = async (socketPath: string, packageDir: string, configFile: string, supervisorPath: string): Promise<Socket> => {
  const existing = await tryConnect(socketPath);

  if (existing !== undefined) return existing;

  const spawn = async (): Promise<void> => spawnSupervisor(supervisorPath, packageDir, configFile);

  await spawn();

  return connectWithBackoff(socketPath, spawn);
};

const leaseOf = (socket: Socket, env: Record<string, string>): ServerLease => {
  const release = (): void => void socket.end();
  const lease: ServerLease = { env, release };

  return lease;
};

/**
 * Spec §7 Start step 3: wait for `ready` or `failed` while `starting` keeps arriving; undefined when the supervisor hung up first.
 * A listener that cannot prove it holds `token` is refused before any of its messages, so its `env` is never used.
 */
const awaitAnswer = async (socket: Socket, socketPath: string, token: string): Promise<ServerLease | undefined> => {
  return new Promise((settle, reject): void => {
    const fail = (error: ServerFailedException): void => {
      socket.destroy();
      reject(error);
    };

    const onSilence = (): void => fail(new ServerFailedException('the supervisor sent nothing for 30 s', ''));
    const onRefused = (): void => fail(new ServerFailedException(`${socketPath} did not prove it holds this user's rendezvous token`, ''));
    let silence = setTimeout(onSilence, CLIENT_SILENCE_MS);

    const onMessage = (message: ServerMessage): void => {
      clearTimeout(silence);

      switch (message.state) {
        case 'starting':
          silence = setTimeout(onSilence, CLIENT_SILENCE_MS);

          return;
        case 'failed':
          return void fail(new ServerFailedException(message.message, message.logTail));
        case 'ready':
          return void settle(leaseOf(socket, message.env));
      }
    };

    socket.on('error', ignoreSocketError);
    socket.once('close', (): void => {
      clearTimeout(silence);
      settle(undefined);
    });
    onVerifiedMessages(socket, token, { onMessage, onRefused });
  });
};

/**
 * Leases the package's shared web servers from its supervisor, starting one when none listens.
 * The lease holds the connection open; `release` closes it, and a crashed exec releases by dropping it.
 */
export const ensureServer = async (packageDir: string, configFile: string, supervisorPath: string): Promise<ServerLease> => {
  const root = resolve(packageDir);
  const socketPath = ownRendezvousPath(root);

  await preparePrivateDir(socketPath);

  const token = ownRendezvousToken(socketPath);

  for (let attempt = 0; attempt < LEASE_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(nextProbeDelay(attempt - 1));

    const socket = await connectSupervisor(socketPath, root, configFile, supervisorPath);
    const lease = await awaitAnswer(socket, socketPath, token);

    if (lease !== undefined) return lease;
  }

  throw new ServerFailedException('the supervisor closed the connection before answering', '');
};
