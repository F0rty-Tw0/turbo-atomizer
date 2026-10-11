type StartingMessage = {
  readonly state: 'starting';
};

type ReadyMessage = {
  readonly state: 'ready';
  readonly env: Record<string, string>;
};

type FailedMessage = {
  readonly state: 'failed';
  readonly message: string;
  readonly logTail: string;
};

export type ServerMessage = StartingMessage | ReadyMessage | FailedMessage;

/** The client's first line: a fresh random challenge per connection. */
export type NonceLine = {
  readonly nonce: string;
};

/** The supervisor's first line: HMAC-SHA256 of the client's nonce, keyed with this user's rendezvous token. */
export type ProofLine = {
  readonly proof: string;
};

export type ServerMessageHandlers = {
  readonly onMessage: (message: ServerMessage) => void;
  readonly onRefused: () => void;
};

export type WaitPattern = {
  readonly source: string;
  readonly flags: string;
};

type SupervisorPhase = 'starting' | 'ready' | 'failed' | 'stopping' | 'stopped';

export type SupervisorState = {
  readonly phase: SupervisorPhase;
  readonly leases: number;
  readonly message: ServerMessage;
};

type SignalEvent = {
  readonly type: 'connect' | 'disconnect' | 'idleTimeout' | 'serversExited';
};

type ServersReadyEvent = {
  readonly type: 'serversReady';
  readonly env: Record<string, string>;
};

type ServerFailedEvent = {
  readonly type: 'serverFailed';
  readonly message: string;
  readonly logTail: string;
};

export type SupervisorEvent = SignalEvent | ServersReadyEvent | ServerFailedEvent;

type MessageEffect = {
  readonly type: 'reply' | 'broadcast';
  readonly message: ServerMessage;
};

type SignalEffect = {
  readonly type: 'scheduleIdle' | 'cancelIdle' | 'startServers' | 'stopServers' | 'exit';
};

export type SupervisorEffect = MessageEffect | SignalEffect;

export type SupervisorTransition = {
  readonly state: SupervisorState;
  readonly effects: SupervisorEffect[];
};
