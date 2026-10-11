import { describe, expect, it } from 'vitest';

import { reduceSupervisor } from './supervisor-state.util.ts';
import type { SupervisorEffect, SupervisorEvent, SupervisorState, SupervisorTransition } from '../common/server-protocol.type.ts';
import { STARTING_MESSAGE } from '../common/server.const.ts';
import { FAILED_MESSAGE_STUB, READY_MESSAGE_STUB, SUPERVISOR_STATE_STUB } from '../test/stubs/supervisor-state.stub.ts';

const readyEnv = { PORT: '4173' };
const connect: SupervisorEvent = { type: 'connect' };
const disconnect: SupervisorEvent = { type: 'disconnect' };
const idleTimeout: SupervisorEvent = { type: 'idleTimeout' };
const serversExited: SupervisorEvent = { type: 'serversExited' };
const serversReady: SupervisorEvent = { type: 'serversReady', env: readyEnv };
const serverFailed: SupervisorEvent = { type: 'serverFailed', message: 'server exited with code 1', logTail: 'boom' };

const replyStarting: SupervisorEffect = { type: 'reply', message: STARTING_MESSAGE };
const replyReady: SupervisorEffect = { type: 'reply', message: READY_MESSAGE_STUB };
const replyFailed: SupervisorEffect = { type: 'reply', message: FAILED_MESSAGE_STUB };
const broadcastStarting: SupervisorEffect = { type: 'broadcast', message: STARTING_MESSAGE };
const broadcastReady: SupervisorEffect = { type: 'broadcast', message: READY_MESSAGE_STUB };
const broadcastFailed: SupervisorEffect = { type: 'broadcast', message: FAILED_MESSAGE_STUB };
const scheduleIdle: SupervisorEffect = { type: 'scheduleIdle' };
const cancelIdle: SupervisorEffect = { type: 'cancelIdle' };
const startServers: SupervisorEffect = { type: 'startServers' };
const stopServers: SupervisorEffect = { type: 'stopServers' };
const exit: SupervisorEffect = { type: 'exit' };

describe('FEATURE: supervisor state', () => {
  describe('GIVEN a starting supervisor without leases', () => {
    const state = SUPERVISOR_STATE_STUB;

    it('WHEN a client connects THEN it takes a lease and is told the servers are starting', () => {
      const next: SupervisorState = { ...state, leases: 1 };
      const expected: SupervisorTransition = { state: next, effects: [replyStarting] };

      const transition = reduceSupervisor(state, connect);

      expect(transition).toEqual(expected);
    });

    it('WHEN the servers become ready THEN it broadcasts ready and schedules the idle stop', () => {
      const next: SupervisorState = { phase: 'ready', leases: 0, message: READY_MESSAGE_STUB };
      const expected: SupervisorTransition = { state: next, effects: [broadcastReady, scheduleIdle] };

      const transition = reduceSupervisor(state, serversReady);

      expect(transition).toEqual(expected);
    });

    it('WHEN a server fails THEN it broadcasts failed, stops the servers and schedules its exit', () => {
      const next: SupervisorState = { phase: 'failed', leases: 0, message: FAILED_MESSAGE_STUB };
      const expected: SupervisorTransition = { state: next, effects: [broadcastFailed, stopServers, scheduleIdle] };

      const transition = reduceSupervisor(state, serverFailed);

      expect(transition).toEqual(expected);
    });

    it('WHEN the servers exit THEN nothing changes', () => {
      const unchanged: SupervisorTransition = { state, effects: [] };

      const transition = reduceSupervisor(state, serversExited);

      expect(transition).toEqual(unchanged);
    });
  });

  describe('GIVEN a starting supervisor with one lease', () => {
    it('WHEN the servers become ready THEN it broadcasts ready without scheduling the idle stop', () => {
      const state: SupervisorState = { ...SUPERVISOR_STATE_STUB, leases: 1 };

      const transition = reduceSupervisor(state, serversReady);

      expect(transition.effects).toEqual([broadcastReady]);
    });
  });

  describe('GIVEN a ready supervisor with one lease', () => {
    const state: SupervisorState = { phase: 'ready', leases: 1, message: READY_MESSAGE_STUB };

    it('WHEN the client disconnects THEN the leases drop to zero and the idle stop is scheduled', () => {
      const next: SupervisorState = { ...state, leases: 0 };
      const expected: SupervisorTransition = { state: next, effects: [scheduleIdle] };

      const transition = reduceSupervisor(state, disconnect);

      expect(transition).toEqual(expected);
    });

    it('WHEN another client connects THEN the idle stop is cancelled and the client is told the servers are ready', () => {
      const next: SupervisorState = { ...state, leases: 2 };
      const expected: SupervisorTransition = { state: next, effects: [cancelIdle, replyReady] };

      const transition = reduceSupervisor(state, connect);

      expect(transition).toEqual(expected);
    });

    it('WHEN a stale idle timer fires THEN nothing changes', () => {
      const unchanged: SupervisorTransition = { state, effects: [] };

      const transition = reduceSupervisor(state, idleTimeout);

      expect(transition).toEqual(unchanged);
    });

    it('WHEN the servers report ready again THEN nothing changes', () => {
      const unchanged: SupervisorTransition = { state, effects: [] };

      const transition = reduceSupervisor(state, serversReady);

      expect(transition).toEqual(unchanged);
    });

    it('WHEN a server fails THEN the supervisor is failed', () => {
      const transition = reduceSupervisor(state, serverFailed);

      expect(transition.state.phase).toBe('failed');
    });
  });

  describe('GIVEN a ready supervisor with two leases', () => {
    it('WHEN one client disconnects THEN one lease remains and no idle stop is scheduled', () => {
      const state: SupervisorState = { phase: 'ready', leases: 2, message: READY_MESSAGE_STUB };
      const next: SupervisorState = { ...state, leases: 1 };
      const expected: SupervisorTransition = { state: next, effects: [] };

      const transition = reduceSupervisor(state, disconnect);

      expect(transition).toEqual(expected);
    });
  });

  describe('GIVEN a ready supervisor without leases', () => {
    it('WHEN the idle timer fires THEN it is stopping and stops the servers', () => {
      const state: SupervisorState = { phase: 'ready', leases: 0, message: READY_MESSAGE_STUB };
      const next: SupervisorState = { phase: 'stopping', leases: 0, message: STARTING_MESSAGE };
      const expected: SupervisorTransition = { state: next, effects: [stopServers] };

      const transition = reduceSupervisor(state, idleTimeout);

      expect(transition).toEqual(expected);
    });
  });

  describe('GIVEN a stopping supervisor without leases', () => {
    const state: SupervisorState = { phase: 'stopping', leases: 0, message: STARTING_MESSAGE };

    it('WHEN a client connects THEN the client waits as a lease and the supervisor keeps stopping', () => {
      const next: SupervisorState = { ...state, leases: 1 };
      const expected: SupervisorTransition = { state: next, effects: [replyStarting] };

      const transition = reduceSupervisor(state, connect);

      expect(transition).toEqual(expected);
    });

    it('WHEN the servers exit THEN it is stopped and exits', () => {
      const next: SupervisorState = { ...state, phase: 'stopped' };
      const expected: SupervisorTransition = { state: next, effects: [exit] };

      const transition = reduceSupervisor(state, serversExited);

      expect(transition).toEqual(expected);
    });

    it('WHEN a server fails THEN nothing changes', () => {
      const unchanged: SupervisorTransition = { state, effects: [] };

      const transition = reduceSupervisor(state, serverFailed);

      expect(transition).toEqual(unchanged);
    });
  });

  describe('GIVEN a stopping supervisor with one waiting client', () => {
    const state: SupervisorState = { phase: 'stopping', leases: 1, message: STARTING_MESSAGE };

    it('WHEN the servers exit THEN it is starting again and restarts the servers', () => {
      const next: SupervisorState = { ...state, phase: 'starting' };
      const expected: SupervisorTransition = { state: next, effects: [startServers, broadcastStarting] };

      const transition = reduceSupervisor(state, serversExited);

      expect(transition).toEqual(expected);
    });

    it('WHEN the waiting client disconnects THEN it keeps stopping without leases', () => {
      const next: SupervisorState = { ...state, leases: 0 };
      const expected: SupervisorTransition = { state: next, effects: [] };

      const transition = reduceSupervisor(state, disconnect);

      expect(transition).toEqual(expected);
    });
  });

  describe('GIVEN a failed supervisor', () => {
    const state: SupervisorState = { phase: 'failed', leases: 1, message: FAILED_MESSAGE_STUB };

    it('WHEN a client connects THEN the client is told the failure', () => {
      const transition = reduceSupervisor(state, connect);

      expect(transition.effects).toEqual([replyFailed]);
    });

    it('WHEN the idle timer fires THEN it is stopped and exits', () => {
      const next: SupervisorState = { ...state, phase: 'stopped' };
      const expected: SupervisorTransition = { state: next, effects: [exit] };

      const transition = reduceSupervisor(state, idleTimeout);

      expect(transition).toEqual(expected);
    });
  });

  describe('GIVEN a stopped supervisor', () => {
    it('WHEN a client connects THEN nothing changes', () => {
      const state: SupervisorState = { phase: 'stopped', leases: 0, message: STARTING_MESSAGE };
      const unchanged: SupervisorTransition = { state, effects: [] };

      const transition = reduceSupervisor(state, connect);

      expect(transition).toEqual(unchanged);
    });
  });
});
