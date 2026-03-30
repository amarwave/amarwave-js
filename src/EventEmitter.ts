import type { EventListener, GlobalEventListener } from './types';

/**
 * Minimal typed event emitter.
 * Used as the base class for both AmarWave and Channel.
 */
export class EventEmitter {
  private _listeners: Record<string, EventListener[]>  = {};
  private _globals:   GlobalEventListener[]            = [];

  /** Add a listener for `event`. Returns `this` for chaining. */
  bind<T = unknown>(event: string, fn: EventListener<T>): this {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn as EventListener);
    return this;
  }

  /** Alias for `bind`. */
  on<T = unknown>(event: string, fn: EventListener<T>): this {
    return this.bind(event, fn);
  }

  /**
   * Remove a listener for `event`.
   * If `fn` is omitted, all listeners for that event are removed.
   */
  unbind(event: string, fn?: EventListener): this {
    if (!fn) {
      delete this._listeners[event];
    } else {
      this._listeners[event] = (this._listeners[event] ?? []).filter(f => f !== fn);
    }
    return this;
  }

  /** Alias for `unbind`. */
  off(event: string, fn?: EventListener): this {
    return this.unbind(event, fn);
  }

  /** Listen to every event emitted on this emitter. */
  bind_global(fn: GlobalEventListener): this {
    this._globals.push(fn);
    return this;
  }

  /** Remove a global listener (or all if `fn` is omitted). */
  unbind_global(fn?: GlobalEventListener): this {
    if (!fn) this._globals = [];
    else this._globals = this._globals.filter(f => f !== fn);
    return this;
  }

  /** @internal Emit an event to all registered listeners. */
  protected _emit(event: string, data?: unknown): void {
    (this._listeners[event] ?? []).slice().forEach(fn => fn(data));
    this._globals.slice().forEach(fn => fn(event, data));
  }

  /**
   * Returns a Promise that resolves with the next emission of `event`.
   * Automatically removes itself after firing once.
   */
  once<T = unknown>(event: string): Promise<T> {
    return new Promise<T>(resolve => {
      const fn: EventListener<T> = (data: T) => {
        this.unbind(event, fn as EventListener);
        resolve(data);
      };
      this.bind(event, fn);
    });
  }
}
