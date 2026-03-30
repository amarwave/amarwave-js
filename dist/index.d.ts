/** Allowed WebSocket transport protocols. */
type Transport = 'ws' | 'wss';
/** All possible states of an AmarWave connection. */
type ConnectionState = 'initialized' | 'connecting' | 'connected' | 'disconnected';
/**
 * Named cluster shorthand. Resolves wsHost, wsPort, wssPort, apiHost, apiPort
 * automatically. Ignored if `wsHost` is also explicitly set.
 */
type ClusterName = 'default' | 'local' | 'ap1' | 'ap2' | 'eu' | 'us' | (string & {});
/** Extra options sent to the `authEndpoint` for private/presence auth. */
interface AuthOptions {
    /** Additional HTTP headers included in every auth request. */
    headers?: Record<string, string>;
}
/**
 * Full configuration object for `new AmarWave(config)`.
 * Only `appKey` is required. Everything else has a sensible default.
 */
interface AmarWaveConfig {
    /** Your AmarWave application key (required). */
    appKey: string;
    /**
     * Your AmarWave application secret.
     * Used for client-side HMAC signing of private/presence channels.
     * ⚠️  Do not expose in production — use `authEndpoint` instead.
     */
    appSecret?: string;
    /** WebSocket server hostname. @default "localhost" */
    wsHost?: string;
    /** WebSocket plain port (ws://). @default 3001 */
    wsPort?: number;
    /** WebSocket TLS port (wss://). Used when forceTLS=true. @default 443 */
    wssPort?: number;
    /**
     * HTTP API hostname for publishing events.
     * Defaults to the same value as `wsHost`.
     */
    apiHost?: string;
    /** HTTP API port. Used internally by channel.publish(). @default 8000 */
    apiPort?: number;
    /**
     * HTTP API path for the trigger endpoint.
     * @default "/api/v1/trigger"
     */
    apiPath?: string;
    /**
     * WebSocket upgrade path on the server.
     * @default "/ws"
     */
    wsPath?: string;
    /**
     * Force WSS (secure WebSocket) and HTTPS for all connections.
     * @default false
     */
    forceTLS?: boolean;
    /**
     * Named cluster shorthand. Automatically sets wsHost, wsPort, wssPort,
     * apiHost, apiPort. Ignored when `wsHost` is explicitly provided.
     * @default "default"
     */
    cluster?: ClusterName;
    /**
     * Server endpoint for private/presence channel auth when appSecret is
     * not set client-side.
     * @default "/broadcasting/auth"
     */
    authEndpoint?: string;
    /**
     * Extra options (e.g. custom headers) sent to `authEndpoint`.
     * @default {}
     */
    auth?: AuthOptions;
    /**
     * Base delay (ms) before the first reconnect attempt.
     * Doubles on each retry (exponential backoff).
     * @default 1000
     */
    reconnectDelay?: number;
    /**
     * Maximum delay (ms) between reconnect attempts.
     * @default 30000
     */
    maxReconnectDelay?: number;
    /**
     * Maximum number of reconnect attempts before giving up.
     * Set to `0` for infinite retries.
     * @default 5
     */
    maxRetries?: number;
    /**
     * Inactivity timeout (ms). If no message is received, a ping is sent
     * to verify the connection is alive.
     * @default 120000
     */
    activityTimeout?: number;
    /**
     * How long (ms) to wait for a pong before closing and reconnecting.
     * @default 30000
     */
    pongTimeout?: number;
    /**
     * Disable usage stat reporting to the server.
     * Ping frames still fire for keepalive, but include `{ stats: false }`.
     * @default false
     */
    disableStats?: boolean;
    /**
     * Allowed transport protocols.
     * - `["ws"]`      — plain WebSocket only (default)
     * - `["wss"]`     — TLS WebSocket only
     * - `["ws","wss"]`— both allowed; ws preferred
     * @default ["ws"]
     */
    enabledTransports?: Transport[];
}
/** Internal resolved config (all fields filled in). */
interface ResolvedConfig extends Required<AmarWaveConfig> {
    apiHost: string;
    apiPath: string;
    wsPath: string;
}
/** Events emitted on the AmarWave instance (connection-level). */
interface AmarWaveEventMap {
    connecting: undefined;
    connected: undefined;
    disconnected: undefined;
    error: Error;
    [event: string]: unknown;
}
/** Events emitted on a Channel instance. */
interface ChannelEventMap {
    /** Fired when the server confirms the subscription. */
    subscribed: unknown;
    /** Fired when subscription fails (server rejected). */
    error: string | Error;
    /** Fired on reconnect re-subscription confirmation. */
    amarwave_internal__subscription_succeeded: unknown;
    amarwave_internal__subscription_error: string;
    [event: string]: unknown;
}
type EventListener<T = unknown> = (data: T) => void;
type GlobalEventListener = (event: string, data: unknown) => void;

/**
 * Minimal typed event emitter.
 * Used as the base class for both AmarWave and Channel.
 */
declare class EventEmitter {
    private _listeners;
    private _globals;
    /** Add a listener for `event`. Returns `this` for chaining. */
    bind<T = unknown>(event: string, fn: EventListener<T>): this;
    /** Alias for `bind`. */
    on<T = unknown>(event: string, fn: EventListener<T>): this;
    /**
     * Remove a listener for `event`.
     * If `fn` is omitted, all listeners for that event are removed.
     */
    unbind(event: string, fn?: EventListener): this;
    /** Alias for `unbind`. */
    off(event: string, fn?: EventListener): this;
    /** Listen to every event emitted on this emitter. */
    bind_global(fn: GlobalEventListener): this;
    /** Remove a global listener (or all if `fn` is omitted). */
    unbind_global(fn?: GlobalEventListener): this;
    /** @internal Emit an event to all registered listeners. */
    protected _emit(event: string, data?: unknown): void;
    /**
     * Returns a Promise that resolves with the next emission of `event`.
     * Automatically removes itself after firing once.
     */
    once<T = unknown>(event: string): Promise<T>;
}

/**
 * Represents a subscription to a named channel on the AmarWave server.
 *
 * Obtained via `aw.subscribe('channel-name')` — never constructed directly.
 *
 * @example
 * const ch = aw.subscribe('public-chat');
 * ch.bind('message', (data: MessagePayload) => console.log(data));
 * ch.publish('message', { user: 'Ali', text: 'Hello!' });
 */
declare class Channel extends EventEmitter {
    /** The channel name (e.g. "public-chat", "private-orders"). */
    readonly name: string;
    /** `true` once the server has confirmed the subscription. */
    subscribed: boolean;
    /** @internal Back-reference to the parent AmarWave client. */
    private _aw;
    /** @internal Publishes queued before subscription was confirmed. */
    private _queue;
    /** @internal */
    constructor(name: string, client: {
        _httpPublish(channel: string, event: string, data: unknown): Promise<boolean>;
    });
    /**
     * Listen for a specific event on this channel.
     * The generic `T` types the `data` argument in the callback.
     *
     * @example
     * ch.bind<{ user: string; text: string }>('message', data => {
     *   console.log(data.user, data.text);
     * });
     */
    bind<T = unknown>(event: string, fn: EventListener<T>): this;
    /** Alias for `bind`. */
    on<T = unknown>(event: string, fn: EventListener<T>): this;
    /** Listen for every event on this channel. */
    bind_global(fn: GlobalEventListener): this;
    /**
     * Publish an event to this channel via the HTTP API.
     *
     * - Safe to call before `subscribed` — calls are queued and flushed
     *   automatically once the subscription is confirmed.
     * - Returns `Promise<boolean>` — `true` on success, `false` on failure.
     *
     * @example
     * await ch.publish('message', { user: 'Ali', text: 'Hello!' });
     */
    publish<T = unknown>(event: string, data: T): Promise<boolean>;
    /**
     * Alias for `publish`. Kept for backwards compatibility.
     * @deprecated Use `publish()` instead.
     */
    trigger<T = unknown>(event: string, data: T): Promise<boolean>;
    /** @internal Called by AmarWave when subscription_succeeded arrives. */
    _flushQueue(): void;
    /** @internal Delegate to base emitter. */
    _fireEvent(event: string, data?: unknown): void;
}

/**
 * Connection proxy object exposed as `aw.connection`.
 * Mirrors state and socket_id from the parent AmarWave instance.
 * Provided for Pusher-compatible API compatibility.
 */
declare class Connection extends EventEmitter {
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
}

/**
 * AmarWave real-time WebSocket client.
 *
 * @example
 * const aw = new AmarWave({ appKey: 'KEY', appSecret: 'SECRET' });
 * const ch = aw.subscribe('public-chat');
 * ch.bind('message', data => console.log(data));
 * ch.publish('message', { user: 'Ali', text: 'Hello!' });
 */
declare class AmarWave extends EventEmitter {
    /** Socket ID assigned by the server. `null` when disconnected. */
    socketId: string | null;
    /** Current connection state. */
    state: ConnectionState;
    /** Pusher-compatible connection proxy. Exposes `.state` and `.socket_id`. */
    readonly connection: Connection;
    private _cfg;
    private _ws;
    private _channels;
    private _retries;
    private _intentional;
    private _actTimer;
    private _pongTimer;
    private _reTimer;
    constructor(config: AmarWaveConfig);
    /**
     * Open the WebSocket. No-op if already connected/connecting.
     * Returns `this` for chaining.
     */
    connect(): this;
    /**
     * Close the connection. No auto-reconnect will fire after this.
     * Returns `this` for chaining.
     */
    disconnect(): this;
    /**
     * Subscribe to a channel. Auto-connects if needed.
     * Returns a `Channel` immediately — safe to `.bind()` and `.publish()` at once.
     *
     * @example
     * const ch = aw.subscribe('public-chat');
     * ch.bind('message', console.log);
     */
    subscribe(channelName: string): Channel;
    /**
     * Unsubscribe from a channel and remove it.
     */
    unsubscribe(channelName: string): this;
    /**
     * Get an already-subscribed channel by name. Returns `null` if not found.
     */
    channel(channelName: string): Channel | null;
    /**
     * Top-level publish shortcut. No need to hold a channel reference.
     * POSTs to the HTTP API. Returns `Promise<boolean>`.
     *
     * @example
     * aw.publish('public-chat', 'message', { user: 'Ali', text: 'Hi' });
     */
    publish<T = unknown>(channelName: string, event: string, data: T): Promise<boolean>;
    bind(event: 'connected' | 'disconnected' | 'connecting', fn: () => void): this;
    bind(event: 'error', fn: EventListener<Error>): this;
    /** @internal Called by Channel.publish() and aw.publish(). */
    _httpPublish(channelName: string, event: string, data: unknown): Promise<boolean>;
    private _buildWsURL;
    private _openSocket;
    private _onOpen;
    private _onRawMessage;
    private _handleMessage;
    private _onError;
    private _onClose;
    private _doSubscribe;
    private _serverAuth;
    private _rawSend;
    private _setState;
    private _resetActivity;
    private _clearActivityTimer;
    private _clearPongTimer;
    private _clearTimers;
}

interface ClusterEntry {
    ws: string;
    wss: string;
    api: string;
}
/**
 * Maps cluster shorthand names to their WS and API base URLs.
 * Both "default" and "local" resolve to localhost for development.
 */
declare const CLUSTERS: Partial<Record<ClusterName, ClusterEntry>>;

export { AmarWave, CLUSTERS, Channel, Connection, EventEmitter, AmarWave as default };
export type { AmarWaveConfig, AmarWaveEventMap, AuthOptions, ChannelEventMap, ClusterName, ConnectionState, EventListener, GlobalEventListener, ResolvedConfig, Transport };
