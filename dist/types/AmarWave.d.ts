import { EventEmitter } from './EventEmitter';
import { Channel } from './Channel';
import { Connection } from './Connection';
import type { AmarWaveConfig, ConnectionState, EventListener } from './types';
/**
 * AmarWave real-time WebSocket client.
 *
 * @example
 * const aw = new AmarWave({ appKey: 'KEY', appSecret: 'SECRET' });
 * const ch = aw.subscribe('public-chat');
 * ch.bind('message', data => console.log(data));
 * ch.publish('message', { user: 'Ali', text: 'Hello!' });
 */
export declare class AmarWave extends EventEmitter {
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
