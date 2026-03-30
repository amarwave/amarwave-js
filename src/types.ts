// ============================================================================
// AmarWave — Public Types
// ============================================================================

/** Allowed WebSocket transport protocols. */
export type Transport = 'ws' | 'wss';

/** All possible states of an AmarWave connection. */
export type ConnectionState =
  | 'initialized'
  | 'connecting'
  | 'connected'
  | 'disconnected';

/**
 * Named cluster shorthand. Resolves wsHost, wsPort, wssPort, apiHost, apiPort
 * automatically. Ignored if `wsHost` is also explicitly set.
 */
export type ClusterName =
  | 'default'
  | 'local'
  | 'ap1'
  | 'ap2'
  | 'eu'
  | 'us'
  | (string & {});

/** Extra options sent to the `authEndpoint` for private/presence auth. */
export interface AuthOptions {
  /** Additional HTTP headers included in every auth request. */
  headers?: Record<string, string>;
}

/**
 * Full configuration object for `new AmarWave(config)`.
 * Only `appKey` is required. Everything else has a sensible default.
 */
export interface AmarWaveConfig {
  // ── Credentials ────────────────────────────────────────────────────────

  /** Your AmarWave application key (required). */
  appKey: string;

  /**
   * Your AmarWave application secret.
   * Used for client-side HMAC signing of private/presence channels.
   * ⚠️  Do not expose in production — use `authEndpoint` instead.
   */
  appSecret?: string;

  // ── Server addresses ───────────────────────────────────────────────────

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

  // ── TLS / cluster ──────────────────────────────────────────────────────

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

  // ── Authentication ─────────────────────────────────────────────────────

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

  // ── Reconnect ──────────────────────────────────────────────────────────

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

  // ── Keepalive ──────────────────────────────────────────────────────────

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

  // ── Misc ───────────────────────────────────────────────────────────────

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
export interface ResolvedConfig extends Required<AmarWaveConfig> {
  apiHost: string;
  apiPath: string;
  wsPath: string;
}

// ─── Event maps ──────────────────────────────────────────────────────────────

/** Events emitted on the AmarWave instance (connection-level). */
export interface AmarWaveEventMap {
  connecting:   undefined;
  connected:    undefined;
  disconnected: undefined;
  error:        Error;
  [event: string]: unknown;
}

/** Events emitted on a Channel instance. */
export interface ChannelEventMap {
  /** Fired when the server confirms the subscription. */
  subscribed: unknown;
  /** Fired when subscription fails (server rejected). */
  error:      string | Error;
  /** Fired on reconnect re-subscription confirmation. */
  amarwave_internal__subscription_succeeded: unknown;
  amarwave_internal__subscription_error:     string;
  [event: string]: unknown;
}

// ─── Listener types ───────────────────────────────────────────────────────────

export type EventListener<T = unknown>       = (data: T) => void;
export type GlobalEventListener             = (event: string, data: unknown) => void;
