import type { EventListener, GlobalEventListener } from './types';
/**
 * Minimal typed event emitter.
 * Used as the base class for both AmarWave and Channel.
 */
export declare class EventEmitter {
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
