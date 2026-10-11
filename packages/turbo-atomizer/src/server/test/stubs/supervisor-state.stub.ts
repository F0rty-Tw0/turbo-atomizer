import type { ServerMessage, SupervisorState } from '../../common/server-protocol.type.ts';
import { STARTING_MESSAGE } from '../../common/server.const.ts';

const env = { PORT: '4173' };

export const READY_MESSAGE_STUB: ServerMessage = { state: 'ready', env };

export const FAILED_MESSAGE_STUB: ServerMessage = { state: 'failed', message: 'server exited with code 1', logTail: 'boom' };

export const SUPERVISOR_STATE_STUB: SupervisorState = { phase: 'starting', leases: 0, message: STARTING_MESSAGE };
