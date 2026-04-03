import { EventEmitter } from './EventEmitter';
import type { ConnectionState } from './types';
/**
 * Connection proxy object exposed as `aw.connection`.
 * Mirrors state and socket_id from the parent AmarWave instance.
 * Provided for Pusher-compatible API compatibility.
 */
export declare class Connection extends EventEmitter {
    /** @internal Mutable state — set by AmarWave. */
    _state: ConnectionState;
    /** @internal Getter/setter backed by AmarWave.socketId. */
    private _getSocketId;
    constructor(getSocketId: () => string | null);
    /** Current connection state. */
    get state(): ConnectionState;
    /** The socket ID assigned by the server. `null` when disconnected. */
    get socket_id(): string | null;
    /** @internal Fire a state event on this proxy. */
    _fireState(state: ConnectionState, data?: unknown): void;
    /** @internal Forward an error to connection-level listeners. */
    _fireError(err: Error): void;
}
