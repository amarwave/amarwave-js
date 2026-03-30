import { EventEmitter }    from './EventEmitter';
import { Channel }         from './Channel';
import { Connection }      from './Connection';
import { hmacSHA256, uid } from './crypto';
import { CLUSTERS }        from './clusters';
import type {
  AmarWaveConfig,
  ResolvedConfig,
  ConnectionState,
  EventListener,
} from './types';

interface WsMessage {
  event:    string;
  channel?: string;
  data?:    unknown;
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
export class AmarWave extends EventEmitter {

  // ── Public ────────────────────────────────────────────────────────────────

  /** Socket ID assigned by the server. `null` when disconnected. */
  socketId: string | null = null;

  /** Current connection state. */
  state: ConnectionState = 'initialized';

  /** Pusher-compatible connection proxy. Exposes `.state` and `.socket_id`. */
  readonly connection: Connection;

  // ── Private ───────────────────────────────────────────────────────────────

  private _cfg:         ResolvedConfig;
  private _ws:          WebSocket | null = null;
  private _channels:    Record<string, Channel> = {};
  private _retries:     number = 0;
  private _intentional: boolean = false;
  private _actTimer:    ReturnType<typeof setTimeout> | null = null;
  private _pongTimer:   ReturnType<typeof setTimeout> | null = null;
  private _reTimer:     ReturnType<typeof setTimeout> | null = null;

  // ─── Constructor ──────────────────────────────────────────────────────────

  constructor(config: AmarWaveConfig) {
    super();

    const raw: ResolvedConfig = {
      appKey:            config.appKey             ?? '',
      appSecret:         config.appSecret          ?? '',
      wsHost:            config.wsHost             ?? 'localhost',
      wsPort:            config.wsPort             ?? 3001,
      wssPort:           config.wssPort            ?? 443,
      apiHost:           config.apiHost            ?? '',
      apiPort:           config.apiPort            ?? 8000,
      apiPath:           config.apiPath            ?? '/api/v1/trigger',
      wsPath:            config.wsPath             ?? '/ws',
      forceTLS:          config.forceTLS           ?? false,
      cluster:           config.cluster            ?? 'default',
      authEndpoint:      config.authEndpoint       ?? '/broadcasting/auth',
      auth:              config.auth               ?? { headers: {} },
      reconnectDelay:    config.reconnectDelay     ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay  ?? 30000,
      maxRetries:        config.maxRetries         ?? 5,
      activityTimeout:   config.activityTimeout    ?? 120000,
      pongTimeout:       config.pongTimeout        ?? 30000,
      disableStats:      config.disableStats       ?? false,
      enabledTransports: config.enabledTransports  ?? ['ws'],
    };

    // Resolve cluster → fill wsHost/wsPort/wssPort/apiHost/apiPort
    // Only when the caller did NOT explicitly provide wsHost.
    if (!config.wsHost) {
      const clusterKey = (raw.cluster ?? 'default').toLowerCase();
      const clusterCfg = CLUSTERS[clusterKey];
      const useTLS     = raw.forceTLS || raw.enabledTransports.includes('wss');

      if (clusterCfg) {
        // Named cluster (e.g. 'default', 'local', 'ap1')
        const baseUrl = useTLS ? clusterCfg.wss : clusterCfg.ws;
        try {
          const parsed = new URL(baseUrl);
          raw.wsHost  = parsed.hostname;
          raw.wsPort  = parseInt(parsed.port) || (useTLS ? 443 : 80);
          raw.wssPort = parseInt(new URL(clusterCfg.wss).port) || 443;
          if (!config.apiHost) {
            const apiParsed = new URL(clusterCfg.api);
            raw.apiHost = apiParsed.hostname;
            raw.apiPort = parseInt(apiParsed.port) ||
                          (clusterCfg.api.startsWith('https') ? 443 : 80);
          }
        } catch { /* leave defaults if URL parse fails */ }
      } else if (raw.cluster && raw.cluster !== 'default') {
        // Raw hostname passed as cluster (e.g. 'amarwave.com', 'localhost')
        raw.wsHost  = raw.cluster;
        raw.wssPort = 443;
        raw.wsPort  = useTLS ? 443 : 3001;
        if (!config.apiHost) {
          raw.apiHost = raw.cluster;
          raw.apiPort = useTLS ? 443 : 8000;
        }
      }
    }

    if (!raw.apiHost) raw.apiHost = raw.wsHost;

    this._cfg       = raw;
    this.connection = new Connection(() => this.socketId);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Open the WebSocket. No-op if already connected/connecting.
   * Returns `this` for chaining.
   */
  connect(): this {
    if (
      this._ws &&
      (this._ws.readyState === WebSocket.OPEN ||
       this._ws.readyState === WebSocket.CONNECTING)
    ) return this;
    this._intentional = false;
    this._openSocket();
    return this;
  }

  /**
   * Close the connection. No auto-reconnect will fire after this.
   * Returns `this` for chaining.
   */
  disconnect(): this {
    this._intentional = true;
    this._clearTimers();
    this._ws?.close(1000, 'user');
    this._setState('disconnected');
    return this;
  }

  /**
   * Subscribe to a channel. Auto-connects if needed.
   * Returns a `Channel` immediately — safe to `.bind()` and `.publish()` at once.
   *
   * @example
   * const ch = aw.subscribe('public-chat');
   * ch.bind('message', console.log);
   */
  subscribe(channelName: string): Channel {
    if (this._channels[channelName]) return this._channels[channelName];
    const ch = new Channel(channelName, this);
    this._channels[channelName] = ch;
    if (this.state === 'connected') {
      void this._doSubscribe(ch);
    } else {
      this.connect();
    }
    return ch;
  }

  /**
   * Unsubscribe from a channel and remove it.
   */
  unsubscribe(channelName: string): this {
    if (!this._channels[channelName]) return this;
    this._rawSend({ event: 'amarwave:unsubscribe', data: { channel: channelName } });
    delete this._channels[channelName];
    return this;
  }

  /**
   * Get an already-subscribed channel by name. Returns `null` if not found.
   */
  channel(channelName: string): Channel | null {
    return this._channels[channelName] ?? null;
  }

  /**
   * Top-level publish shortcut. No need to hold a channel reference.
   * POSTs to the HTTP API. Returns `Promise<boolean>`.
   *
   * @example
   * aw.publish('public-chat', 'message', { user: 'Ali', text: 'Hi' });
   */
  publish<T = unknown>(channelName: string, event: string, data: T): Promise<boolean> {
    return this._httpPublish(channelName, event, data);
  }

  // Overloaded bind for better IDE autocomplete on connection events
  bind(event: 'connected' | 'disconnected' | 'connecting', fn: () => void): this;
  bind(event: 'error', fn: EventListener<Error>): this;
  bind<T = unknown>(event: string, fn: EventListener<T>): this {
    return super.bind(event, fn as EventListener);
  }

  // ─── HTTP publish ─────────────────────────────────────────────────────────

  /** @internal Called by Channel.publish() and aw.publish(). */
  async _httpPublish(channelName: string, event: string, data: unknown): Promise<boolean> {
    const c     = this._cfg;
    const proto       = c.forceTLS ? 'https' : 'http';
    const defaultPort = c.forceTLS ? 443 : 80;
    const portStr     = c.apiPort === defaultPort ? '' : `:${c.apiPort}`;
    const url         = `${proto}://${c.apiHost}${portStr}${c.apiPath}`;
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key:    c.appKey,
          app_secret: c.appSecret,
          channel:    channelName,
          name:       event,
          data,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as Record<string, unknown>;
        console.warn('[AmarWave] publish failed', res.status, j);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[AmarWave] publish error:', (e as Error).message);
      return false;
    }
  }

  // ─── WebSocket lifecycle ──────────────────────────────────────────────────

  private _buildWsURL(): string {
    const c      = this._cfg;
    const useTLS = c.forceTLS ||
      (Array.isArray(c.enabledTransports) &&
       c.enabledTransports.includes('wss') &&
       !c.enabledTransports.includes('ws'));
    const proto       = useTLS ? 'wss' : 'ws';
    const port        = useTLS ? c.wssPort : c.wsPort;
    const defaultPort = useTLS ? 443 : 80;
    const portStr     = port === defaultPort ? '' : `:${port}`;
    return `${proto}://${c.wsHost}${portStr}${c.wsPath}?app_key=${encodeURIComponent(c.appKey)}`;
  }

  private _openSocket(): void {
    this._setState('connecting');
    try {
      this._ws = new WebSocket(this._buildWsURL());
    } catch (e) {
      this._onError(e as Error);
      return;
    }
    this._ws.onopen    = ()  => this._onOpen();
    this._ws.onmessage = (e) => this._onRawMessage(e);
    this._ws.onerror   = ()  => this._onError(new Error('WebSocket error'));
    this._ws.onclose   = ()  => this._onClose();
  }

  private _onOpen(): void {
    this._resetActivity();
  }

  private _onRawMessage(raw: MessageEvent): void {
    this._resetActivity();
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw.data as string) as WsMessage;
    } catch {
      return;
    }
    if (typeof msg.data === 'string') {
      try { msg.data = JSON.parse(msg.data); } catch { /* leave as string */ }
    }
    this._handleMessage(msg);
  }

  private _handleMessage(msg: WsMessage): void {
    switch (msg.event) {

      case 'amarwave:connection_established': {
        const d = msg.data as { socket_id: string };
        this.socketId = d.socket_id;
        this._retries = 0;
        this._setState('connected');
        // Re-subscribe all channels (also handles reconnect)
        Object.values(this._channels).forEach(ch => {
          ch.subscribed = false;
          void this._doSubscribe(ch);
        });
        break;
      }

      case 'amarwave:error': {
        const errData = msg.data as { message?: string } | string;
        const errMsg  = typeof errData === 'object' ? errData.message : errData;
        this._onError(new Error(errMsg ?? 'Server error'));
        break;
      }

      case 'amarwave:pong':
        this._clearPongTimer();
        break;

      case 'amarwave_internal:subscription_succeeded': {
        const ch = this._channels[msg.channel ?? ''];
        if (ch) {
          ch.subscribed = true;
          ch._fireEvent('subscribed', msg.data);
          ch._fireEvent('amarwave_internal:subscription_succeeded', msg.data);
          ch._flushQueue();
        }
        break;
      }

      case 'amarwave_internal:subscription_error': {
        const ch = this._channels[msg.channel ?? ''];
        if (ch) ch._fireEvent('error', msg.data);
        break;
      }

      default:
        if (msg.channel && this._channels[msg.channel]) {
          this._channels[msg.channel]._fireEvent(msg.event, msg.data);
        }
        // Bubble to instance listeners
        this._emit(msg.event, { channel: msg.channel, data: msg.data });
    }
  }

  private _onError(err: Error): void {
    this._emit('error', err);
    this.connection._fireState(this.state);
  }

  private _onClose(): void {
    this._clearTimers();
    this.socketId = null;
    Object.values(this._channels).forEach(ch => { ch.subscribed = false; });

    if (this._intentional) {
      this._setState('disconnected');
      return;
    }

    this._setState('disconnected');

    const max = this._cfg.maxRetries;
    if (max > 0 && this._retries >= max) {
      console.warn('[AmarWave] Max reconnect attempts reached.');
      return;
    }

    const delay = Math.min(
      this._cfg.reconnectDelay * Math.pow(2, this._retries),
      this._cfg.maxReconnectDelay,
    );
    this._retries++;
    this._reTimer = setTimeout(() => this._openSocket(), delay);
  }

  // ─── Channel subscribe ────────────────────────────────────────────────────

  private async _doSubscribe(ch: Channel): Promise<void> {
    const name    = ch.name;
    const payload: { event: string; data: Record<string, string> } = {
      event: 'amarwave:subscribe',
      data:  { channel: name },
    };

    try {
      if (name.startsWith('presence-')) {
        if (this._cfg.appSecret) {
          const cd  = JSON.stringify({ user_id: uid(), user_info: {} });
          const sig = await hmacSHA256(
            this._cfg.appSecret,
            `${this.socketId}:${name}:${cd}`,
          );
          payload.data['auth']         = `${this._cfg.appKey}:${sig}`;
          payload.data['channel_data'] = cd;
        } else {
          await this._serverAuth(ch, payload);
        }
      } else if (name.startsWith('private-')) {
        if (this._cfg.appSecret) {
          const sig = await hmacSHA256(
            this._cfg.appSecret,
            `${this.socketId}:${name}`,
          );
          payload.data['auth'] = `${this._cfg.appKey}:${sig}`;
        } else {
          await this._serverAuth(ch, payload);
        }
      }
    } catch (e) {
      ch._fireEvent('error', (e as Error).message);
      return;
    }

    this._rawSend(payload);
  }

  private async _serverAuth(
    ch: Channel,
    payload: { data: Record<string, string> },
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this._cfg.auth?.headers ?? {}),
    };
    const res = await fetch(this._cfg.authEndpoint, {
      method:  'POST',
      headers,
      body:    JSON.stringify({
        socket_id:    this.socketId,
        channel_name: ch.name,
      }),
    });
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const json = await res.json() as Record<string, string>;
    Object.assign(payload.data, json);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private _rawSend(payload: unknown): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(payload));
    }
  }

  private _setState(s: ConnectionState): void {
    this.state = s;
    this._emit(s);
    this.connection._fireState(s);
  }

  private _resetActivity(): void {
    this._clearActivityTimer();
    this._actTimer = setTimeout(() => {
      const ping = this._cfg.disableStats
        ? { event: 'amarwave:ping', data: { stats: false } }
        : { event: 'amarwave:ping', data: {} };
      this._rawSend(ping);
      this._pongTimer = setTimeout(() => {
        console.warn('[AmarWave] Pong timeout — reconnecting');
        this._ws?.close();
      }, this._cfg.pongTimeout);
    }, this._cfg.activityTimeout);
  }

  private _clearActivityTimer(): void {
    if (this._actTimer !== null) {
      clearTimeout(this._actTimer);
      this._actTimer = null;
    }
  }

  private _clearPongTimer(): void {
    if (this._pongTimer !== null) {
      clearTimeout(this._pongTimer);
      this._pongTimer = null;
    }
  }

  private _clearTimers(): void {
    this._clearActivityTimer();
    this._clearPongTimer();
    if (this._reTimer !== null) {
      clearTimeout(this._reTimer);
      this._reTimer = null;
    }
  }
}
