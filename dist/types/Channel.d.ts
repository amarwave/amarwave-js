import { EventEmitter } from './EventEmitter';
import type { EventListener, GlobalEventListener } from './types';
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
export declare class Channel extends EventEmitter {
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
