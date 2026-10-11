import type {
  ServerMessage,
  SupervisorEffect,
  SupervisorEvent,
  SupervisorState,
  SupervisorTransition
} from '../common/server-protocol.type.ts';
import { STARTING_MESSAGE } from '../common/server.const.ts';

const SCHEDULE_IDLE: SupervisorEffect = { type: 'scheduleIdle' };
const CANCEL_IDLE: SupervisorEffect = { type: 'cancelIdle' };
const START_SERVERS: SupervisorEffect = { type: 'startServers' };
const STOP_SERVERS: SupervisorEffect = { type: 'stopServers' };
const EXIT: SupervisorEffect = { type: 'exit' };
const BROADCAST_STARTING: SupervisorEffect = { type: 'broadcast', message: STARTING_MESSAGE };

const unchanged = (state: SupervisorState): SupervisorTransition => {
  const transition: SupervisorTransition = { state, effects: [] };

  return transition;
};

const stopped = (state: SupervisorState): SupervisorTransition => {
  const next: SupervisorState = { ...state, phase: 'stopped' };
  const transition: SupervisorTransition = { state: next, effects: [EXIT] };

  return transition;
};

const onConnect = (state: SupervisorState): SupervisorTransition => {
  const next: SupervisorState = { ...state, leases: state.leases + 1 };
  const reply: SupervisorEffect = { type: 'reply', message: state.message };
  const transition: SupervisorTransition = { state: next, effects: [reply] };

  if (state.phase !== 'ready') return transition;

  const resumed: SupervisorTransition = { state: next, effects: [CANCEL_IDLE, reply] };

  return resumed;
};

const onDisconnect = (state: SupervisorState): SupervisorTransition => {
  const leases = state.leases - 1;
  const next: SupervisorState = { ...state, leases };
  const transition: SupervisorTransition = { state: next, effects: [] };
  const isIdle = state.phase === 'ready' && leases === 0;

  if (!isIdle) return transition;

  const idle: SupervisorTransition = { state: next, effects: [SCHEDULE_IDLE] };

  return idle;
};

const onServersReady = (state: SupervisorState, env: Record<string, string>): SupervisorTransition => {
  if (state.phase !== 'starting') return unchanged(state);

  const message: ServerMessage = { state: 'ready', env };
  const next: SupervisorState = { ...state, phase: 'ready', message };
  const broadcast: SupervisorEffect = { type: 'broadcast', message };
  const transition: SupervisorTransition = { state: next, effects: [broadcast] };

  if (state.leases > 0) return transition;

  const idle: SupervisorTransition = { state: next, effects: [broadcast, SCHEDULE_IDLE] };

  return idle;
};

const onServerFailed = (state: SupervisorState, failure: string, logTail: string): SupervisorTransition => {
  const isRunning = state.phase === 'starting' || state.phase === 'ready';

  if (!isRunning) return unchanged(state);

  const message: ServerMessage = { state: 'failed', message: failure, logTail };
  const next: SupervisorState = { ...state, phase: 'failed', message };
  const broadcast: SupervisorEffect = { type: 'broadcast', message };
  const transition: SupervisorTransition = { state: next, effects: [broadcast, STOP_SERVERS, SCHEDULE_IDLE] };

  return transition;
};

const onIdleTimeout = (state: SupervisorState): SupervisorTransition => {
  if (state.phase === 'failed') return stopped(state);

  const isIdle = state.phase === 'ready' && state.leases === 0;

  if (!isIdle) return unchanged(state);

  const next: SupervisorState = { ...state, phase: 'stopping', message: STARTING_MESSAGE };
  const transition: SupervisorTransition = { state: next, effects: [STOP_SERVERS] };

  return transition;
};

const onServersExited = (state: SupervisorState): SupervisorTransition => {
  if (state.phase !== 'stopping') return unchanged(state);

  if (state.leases === 0) return stopped(state);

  const next: SupervisorState = { ...state, phase: 'starting' };
  const transition: SupervisorTransition = { state: next, effects: [START_SERVERS, BROADCAST_STARTING] };

  return transition;
};

export const reduceSupervisor = (state: SupervisorState, event: SupervisorEvent): SupervisorTransition => {
  if (state.phase === 'stopped') return unchanged(state);

  switch (event.type) {
    case 'connect':
      return onConnect(state);
    case 'disconnect':
      return onDisconnect(state);
    case 'serversReady':
      return onServersReady(state, event.env);
    case 'serverFailed':
      return onServerFailed(state, event.message, event.logTail);
    case 'idleTimeout':
      return onIdleTimeout(state);
    case 'serversExited':
      return onServersExited(state);
  }
};
