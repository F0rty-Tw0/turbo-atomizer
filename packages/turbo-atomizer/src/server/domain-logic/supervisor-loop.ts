import type { Socket } from 'node:net';

import { startWebServers, stopWebServers } from './web-servers.ts';
import type { ServerMessage, SupervisorEffect, SupervisorEvent, SupervisorState } from '../common/server-protocol.type.ts';
import { INITIAL_SUPERVISOR_STATE, STARTING_INTERVAL_MS, STARTING_MESSAGE } from '../common/server.const.ts';
import type { RunningServer, SupervisorLoopOptions } from '../common/server.type.ts';
import { sendMessage } from '../data-access/rendezvous.socket.ts';
import { reduceSupervisor } from '../utils/supervisor-state.util.ts';

const CONNECT: SupervisorEvent = { type: 'connect' };
const DISCONNECT: SupervisorEvent = { type: 'disconnect' };
const IDLE_TIMEOUT: SupervisorEvent = { type: 'idleTimeout' };
const SERVERS_EXITED: SupervisorEvent = { type: 'serversExited' };

const ignoreSocketError = (): void => undefined;

/**
 * Runs the effects `reduceSupervisor` returns against real sockets, timers and servers.
 * Every connected client is a lease; `done` settles once the supervisor has stopped its servers and dropped its clients.
 */
export class SupervisorLoop {
  public readonly done: Promise<void>;
  private readonly options: SupervisorLoopOptions;
  private readonly clients = new Set<Socket>();
  private readonly finish: () => void;
  private state: SupervisorState = INITIAL_SUPERVISOR_STATE;
  private servers: RunningServer[] = [];
  private stopping: Promise<void> = Promise.resolve();
  private idleTimer: NodeJS.Timeout | undefined;
  private heartbeat: NodeJS.Timeout | undefined;

  public constructor(options: SupervisorLoopOptions) {
    const { promise, resolve } = Promise.withResolvers<undefined>();

    this.options = options;
    this.done = promise;
    this.finish = (): void => resolve(undefined);
  }

  public readonly onConnection = (socket: Socket): void => {
    if (this.state.phase === 'stopped') return void socket.destroy();

    this.clients.add(socket);
    socket.on('error', ignoreSocketError);
    socket.once('close', (): void => {
      this.clients.delete(socket);
      this.dispatch(DISCONNECT);
    });
    this.dispatch(CONNECT, socket);
  };

  public start(): void {
    const failure = this.options.startupFailure;

    this.heartbeat = setInterval(this.onHeartbeat, STARTING_INTERVAL_MS);

    if (failure === undefined) return void this.startServers();

    this.dispatch({ type: 'serverFailed', message: failure, logTail: '' });
  }

  private readonly onHeartbeat = (): void => {
    const { phase } = this.state;
    const isWaiting = phase === 'starting' || phase === 'stopping';

    if (isWaiting) this.broadcast(STARTING_MESSAGE);
  };

  private dispatch(event: SupervisorEvent, client?: Socket): void {
    const transition = reduceSupervisor(this.state, event);

    this.state = transition.state;

    for (const effect of transition.effects) this.apply(effect, client);
  }

  private apply(effect: SupervisorEffect, client: Socket | undefined): void {
    switch (effect.type) {
      case 'reply':
        if (client !== undefined) sendMessage(client, effect.message);

        return;
      case 'broadcast':
        return void this.broadcast(effect.message);
      case 'scheduleIdle':
        clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout((): void => this.dispatch(IDLE_TIMEOUT), this.options.idleMs);

        return;
      case 'cancelIdle':
        return void clearTimeout(this.idleTimer);
      case 'startServers':
        return void this.startServers();
      case 'stopServers':
        this.stopping = this.stopServers();

        return;
      case 'exit':
        return void this.exit();
    }
  }

  private broadcast(message: ServerMessage): void {
    for (const client of this.clients) sendMessage(client, message);
  }

  private async startServers(): Promise<void> {
    const { configFile, log, packageDir } = this.options;
    const outcome = await startWebServers(packageDir, configFile, log);

    this.servers = outcome.servers;

    if (!outcome.ok) return void this.dispatch({ type: 'serverFailed', message: outcome.message, logTail: outcome.logTail });

    for (const server of outcome.servers) this.watchExit(server);

    this.dispatch({ type: 'serversReady', env: outcome.env });
  }

  /** A server that dies after `ready` fails the supervisor, so no later lease is handed a dead port; one being stopped is ignored. */
  private watchExit(server: RunningServer): void {
    const { child, fact } = server;

    const onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
      const isCurrent = this.servers.includes(server);

      if (!isCurrent) return;

      const byCode = `code ${String(code)}`;
      const bySignal = `signal ${String(signal)}`;
      const exit = signal === null ? byCode : bySignal;
      const message = `webServer "${fact.command}" exited with ${exit} after it was ready; see .atomizer/server.log`;

      this.dispatch({ type: 'serverFailed', message, logTail: '' });
    };

    const hasExited = child.exitCode !== null || child.signalCode !== null;

    if (hasExited) return void onClose(child.exitCode, child.signalCode);

    child.once('close', onClose);
  }

  private async stopServers(): Promise<void> {
    const running = this.servers;

    this.servers = [];

    try {
      await stopWebServers(running);
    } catch (error) {
      this.options.log.write(`[turbo-atomizer] stopping the web servers failed: ${String(error)}\n`);
    }

    this.dispatch(SERVERS_EXITED);
  }

  private async exit(): Promise<void> {
    clearInterval(this.heartbeat);
    clearTimeout(this.idleTimer);
    await this.stopping;

    for (const client of this.clients) client.destroy();

    this.finish();
  }
}
