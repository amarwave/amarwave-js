import { EventEmitter }      from './EventEmitter';
import type { ConnectionState } from './types';

/**
 * Connection proxy object exposed as `aw.connection`.
 * Mirrors state and socket_id from the parent AmarWave instance.
 * Provided for Pusher-compatible API compatibility.
 */
export class Connection extends EventEmitter {
  /** @internal Mutable state — set by AmarWave. */
  _state: ConnectionState = 'initialized';

  /** @internal Getter/setter backed by AmarWave.socketId. */
  private _getSocketId: () => string | null;

  constructor(getSocketId: () => string | null) {
    super();
    this._getSocketId = getSocketId;
  }

  /** Current connection state. */
  get state(): ConnectionState {
    return this._state;
  }

  /** The socket ID assigned by the server. `null` when disconnected. */
  get socket_id(): string | null {
    return this._getSocketId();
  }

  /** @internal Fire a state event on this proxy. */
  _fireState(state: ConnectionState, data?: unknown): void {
    this._state = state;
    this._emit(state, data);
  }

  /** @internal Forward an error to connection-level listeners. */
  _fireError(err: Error): void {
    this._emit('error', err);
  }
}
