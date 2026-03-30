import { EventEmitter }           from './EventEmitter';
import type { EventListener, GlobalEventListener } from './types';

interface QueuedPublish {
  event:   string;
  data:    unknown;
  resolve: (ok: boolean) => void;
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
export class Channel extends EventEmitter {
  /** The channel name (e.g. "public-chat", "private-orders"). */
  readonly name: string;

  /** `true` once the server has confirmed the subscription. */
  subscribed: boolean = false;

  /** @internal Back-reference to the parent AmarWave client. */
  private _aw: {
    _httpPublish(channel: string, event: string, data: unknown): Promise<boolean>;
  };

  /** @internal Publishes queued before subscription was confirmed. */
  private _queue: QueuedPublish[] = [];

  /** @internal */
  constructor(
    name: string,
    client: { _httpPublish(channel: string, event: string, data: unknown): Promise<boolean> },
  ) {
    super();
    this.name = name;
    this._aw  = client;
  }

  // ── Bind overloads ────────────────────────────────────────────────────────

  /**
   * Listen for a specific event on this channel.
   * The generic `T` types the `data` argument in the callback.
   *
   * @example
   * ch.bind<{ user: string; text: string }>('message', data => {
   *   console.log(data.user, data.text);
   * });
   */
  bind<T = unknown>(event: string, fn: EventListener<T>): this {
    return super.bind(event, fn);
  }

  /** Alias for `bind`. */
  on<T = unknown>(event: string, fn: EventListener<T>): this {
    return super.on(event, fn);
  }

  /** Listen for every event on this channel. */
  bind_global(fn: GlobalEventListener): this {
    return super.bind_global(fn);
  }

  // ── Publish ───────────────────────────────────────────────────────────────

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
  publish<T = unknown>(event: string, data: T): Promise<boolean> {
    if (!this.subscribed) {
      return new Promise<boolean>(resolve => {
        this._queue.push({ event, data, resolve });
      });
    }
    return this._aw._httpPublish(this.name, event, data);
  }

  /**
   * Alias for `publish`. Kept for backwards compatibility.
   * @deprecated Use `publish()` instead.
   */
  trigger<T = unknown>(event: string, data: T): Promise<boolean> {
    return this.publish(event, data);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /** @internal Called by AmarWave when subscription_succeeded arrives. */
  _flushQueue(): void {
    this._queue.splice(0).forEach(({ event, data, resolve }) => {
      this._aw._httpPublish(this.name, event, data).then(resolve);
    });
  }

  /** @internal Delegate to base emitter. */
  _fireEvent(event: string, data?: unknown): void {
    this._emit(event, data);
  }
}
