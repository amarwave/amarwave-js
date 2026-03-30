/*!
 * AmarWave JS Client v2.0.0
 * Real-time WebSocket client for AmarWave servers
 * (c) 2024 AmarWave — MIT License
 * https://amarwave.io
 */
/**
 * Minimal typed event emitter.
 * Used as the base class for both AmarWave and Channel.
 */
class EventEmitter {
    constructor() {
        this._listeners = {};
        this._globals = [];
    }
    /** Add a listener for `event`. Returns `this` for chaining. */
    bind(event, fn) {
        if (!this._listeners[event])
            this._listeners[event] = [];
        this._listeners[event].push(fn);
        return this;
    }
    /** Alias for `bind`. */
    on(event, fn) {
        return this.bind(event, fn);
    }
    /**
     * Remove a listener for `event`.
     * If `fn` is omitted, all listeners for that event are removed.
     */
    unbind(event, fn) {
        var _a;
        if (!fn) {
            delete this._listeners[event];
        }
        else {
            this._listeners[event] = ((_a = this._listeners[event]) !== null && _a !== void 0 ? _a : []).filter(f => f !== fn);
        }
        return this;
    }
    /** Alias for `unbind`. */
    off(event, fn) {
        return this.unbind(event, fn);
    }
    /** Listen to every event emitted on this emitter. */
    bind_global(fn) {
        this._globals.push(fn);
        return this;
    }
    /** Remove a global listener (or all if `fn` is omitted). */
    unbind_global(fn) {
        if (!fn)
            this._globals = [];
        else
            this._globals = this._globals.filter(f => f !== fn);
        return this;
    }
    /** @internal Emit an event to all registered listeners. */
    _emit(event, data) {
        var _a;
        ((_a = this._listeners[event]) !== null && _a !== void 0 ? _a : []).slice().forEach(fn => fn(data));
        this._globals.slice().forEach(fn => fn(event, data));
    }
    /**
     * Returns a Promise that resolves with the next emission of `event`.
     * Automatically removes itself after firing once.
     */
    once(event) {
        return new Promise(resolve => {
            const fn = (data) => {
                this.unbind(event, fn);
                resolve(data);
            };
            this.bind(event, fn);
        });
    }
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
class Channel extends EventEmitter {
    /** @internal */
    constructor(name, client) {
        super();
        /** `true` once the server has confirmed the subscription. */
        this.subscribed = false;
        /** @internal Publishes queued before subscription was confirmed. */
        this._queue = [];
        this.name = name;
        this._aw = client;
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
    bind(event, fn) {
        return super.bind(event, fn);
    }
    /** Alias for `bind`. */
    on(event, fn) {
        return super.on(event, fn);
    }
    /** Listen for every event on this channel. */
    bind_global(fn) {
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
    publish(event, data) {
        if (!this.subscribed) {
            return new Promise(resolve => {
                this._queue.push({ event, data, resolve });
            });
        }
        return this._aw._httpPublish(this.name, event, data);
    }
    /**
     * Alias for `publish`. Kept for backwards compatibility.
     * @deprecated Use `publish()` instead.
     */
    trigger(event, data) {
        return this.publish(event, data);
    }
    // ── Internal ──────────────────────────────────────────────────────────────
    /** @internal Called by AmarWave when subscription_succeeded arrives. */
    _flushQueue() {
        this._queue.splice(0).forEach(({ event, data, resolve }) => {
            this._aw._httpPublish(this.name, event, data).then(resolve);
        });
    }
    /** @internal Delegate to base emitter. */
    _fireEvent(event, data) {
        this._emit(event, data);
    }
}

/**
 * Connection proxy object exposed as `aw.connection`.
 * Mirrors state and socket_id from the parent AmarWave instance.
 * Provided for Pusher-compatible API compatibility.
 */
class Connection extends EventEmitter {
    constructor(getSocketId) {
        super();
        /** @internal Mutable state — set by AmarWave. */
        this._state = 'initialized';
        this._getSocketId = getSocketId;
    }
    /** Current connection state. */
    get state() {
        return this._state;
    }
    /** The socket ID assigned by the server. `null` when disconnected. */
    get socket_id() {
        return this._getSocketId();
    }
    /** @internal Fire a state event on this proxy. */
    _fireState(state, data) {
        this._state = state;
        this._emit(state, data);
    }
}

/**
 * Compute HMAC-SHA256 and return as lowercase hex string.
 * Uses the WebCrypto API (available in all modern browsers and Node 18+).
 */
async function hmacSHA256(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const buf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
/** Generate a short random ID string. */
function uid() {
    return Math.random().toString(36).slice(2, 10) +
        Math.random().toString(36).slice(2, 10);
}

/**
 * Maps cluster shorthand names to their WS and API base URLs.
 * Both "default" and "local" resolve to localhost for development.
 */
const CLUSTERS = {
    default: {
        ws: 'ws://amarwave.com',
        wss: 'wss://amarwave.com',
        api: 'https://amarwave.com',
    },
    local: {
        ws: 'ws://localhost:3001',
        wss: 'wss://localhost:3001',
        api: 'http://localhost:8000',
    },
    ap1: {
        ws: 'ws://amarwave.com',
        wss: 'wss://amarwave.com',
        api: 'https://amarwave.com',
    },
    ap2: {
        ws: 'ws://amarwave.com',
        wss: 'wss://amarwave.com',
        api: 'https://amarwave.com',
    },
    eu: {
        ws: 'ws://amarwave.com',
        wss: 'wss://amarwave.com',
        api: 'https://amarwave.com',
    },
    us: {
        ws: 'ws://amarwave.com',
        wss: 'wss://amarwave.com',
        api: 'https://amarwave.com',
    },
};

/**
 * AmarWave real-time WebSocket client.
 *
 * @example
 * const aw = new AmarWave({ appKey: 'KEY', appSecret: 'SECRET' });
 * const ch = aw.subscribe('public-chat');
 * ch.bind('message', data => console.log(data));
 * ch.publish('message', { user: 'Ali', text: 'Hello!' });
 */
class AmarWave extends EventEmitter {
    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(config) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        super();
        // ── Public ────────────────────────────────────────────────────────────────
        /** Socket ID assigned by the server. `null` when disconnected. */
        this.socketId = null;
        /** Current connection state. */
        this.state = 'initialized';
        this._ws = null;
        this._channels = {};
        this._retries = 0;
        this._intentional = false;
        this._actTimer = null;
        this._pongTimer = null;
        this._reTimer = null;
        const raw = {
            appKey: (_a = config.appKey) !== null && _a !== void 0 ? _a : '',
            appSecret: (_b = config.appSecret) !== null && _b !== void 0 ? _b : '',
            wsHost: (_c = config.wsHost) !== null && _c !== void 0 ? _c : 'localhost',
            wsPort: (_d = config.wsPort) !== null && _d !== void 0 ? _d : 3001,
            wssPort: (_e = config.wssPort) !== null && _e !== void 0 ? _e : 443,
            apiHost: (_f = config.apiHost) !== null && _f !== void 0 ? _f : '',
            apiPort: (_g = config.apiPort) !== null && _g !== void 0 ? _g : 8000,
            apiPath: (_h = config.apiPath) !== null && _h !== void 0 ? _h : '/api/v1/trigger',
            wsPath: (_j = config.wsPath) !== null && _j !== void 0 ? _j : '/ws',
            forceTLS: (_k = config.forceTLS) !== null && _k !== void 0 ? _k : false,
            cluster: (_l = config.cluster) !== null && _l !== void 0 ? _l : 'default',
            authEndpoint: (_m = config.authEndpoint) !== null && _m !== void 0 ? _m : '/broadcasting/auth',
            auth: (_o = config.auth) !== null && _o !== void 0 ? _o : { headers: {} },
            reconnectDelay: (_p = config.reconnectDelay) !== null && _p !== void 0 ? _p : 1000,
            maxReconnectDelay: (_q = config.maxReconnectDelay) !== null && _q !== void 0 ? _q : 30000,
            maxRetries: (_r = config.maxRetries) !== null && _r !== void 0 ? _r : 5,
            activityTimeout: (_s = config.activityTimeout) !== null && _s !== void 0 ? _s : 120000,
            pongTimeout: (_t = config.pongTimeout) !== null && _t !== void 0 ? _t : 30000,
            disableStats: (_u = config.disableStats) !== null && _u !== void 0 ? _u : false,
            enabledTransports: (_v = config.enabledTransports) !== null && _v !== void 0 ? _v : ['ws'],
        };
        // Resolve cluster → fill wsHost/wsPort/wssPort/apiHost/apiPort
        // Only when the caller did NOT explicitly provide wsHost.
        if (!config.wsHost) {
            const clusterKey = ((_w = raw.cluster) !== null && _w !== void 0 ? _w : 'default').toLowerCase();
            const clusterCfg = CLUSTERS[clusterKey];
            const useTLS = raw.forceTLS || raw.enabledTransports.includes('wss');
            if (clusterCfg) {
                // Named cluster (e.g. 'default', 'local', 'ap1')
                const baseUrl = useTLS ? clusterCfg.wss : clusterCfg.ws;
                try {
                    const parsed = new URL(baseUrl);
                    raw.wsHost = parsed.hostname;
                    raw.wsPort = parseInt(parsed.port) || (useTLS ? 443 : 80);
                    raw.wssPort = parseInt(new URL(clusterCfg.wss).port) || 443;
                    if (!config.apiHost) {
                        const apiParsed = new URL(clusterCfg.api);
                        raw.apiHost = apiParsed.hostname;
                        raw.apiPort = parseInt(apiParsed.port) ||
                            (clusterCfg.api.startsWith('https') ? 443 : 80);
                    }
                }
                catch ( /* leave defaults if URL parse fails */_x) { /* leave defaults if URL parse fails */ }
            }
            else if (raw.cluster && raw.cluster !== 'default') {
                // Raw hostname passed as cluster (e.g. 'amarwave.com', 'localhost')
                raw.wsHost = raw.cluster;
                raw.wssPort = 443;
                raw.wsPort = useTLS ? 443 : 3001;
                if (!config.apiHost) {
                    raw.apiHost = raw.cluster;
                    raw.apiPort = useTLS ? 443 : 8000;
                }
            }
        }
        if (!raw.apiHost)
            raw.apiHost = raw.wsHost;
        this._cfg = raw;
        this.connection = new Connection(() => this.socketId);
    }
    // ─── Public API ───────────────────────────────────────────────────────────
    /**
     * Open the WebSocket. No-op if already connected/connecting.
     * Returns `this` for chaining.
     */
    connect() {
        if (this._ws &&
            (this._ws.readyState === WebSocket.OPEN ||
                this._ws.readyState === WebSocket.CONNECTING))
            return this;
        this._intentional = false;
        this._openSocket();
        return this;
    }
    /**
     * Close the connection. No auto-reconnect will fire after this.
     * Returns `this` for chaining.
     */
    disconnect() {
        var _a;
        this._intentional = true;
        this._clearTimers();
        (_a = this._ws) === null || _a === void 0 ? void 0 : _a.close(1000, 'user');
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
    subscribe(channelName) {
        if (this._channels[channelName])
            return this._channels[channelName];
        const ch = new Channel(channelName, this);
        this._channels[channelName] = ch;
        if (this.state === 'connected') {
            void this._doSubscribe(ch);
        }
        else {
            this.connect();
        }
        return ch;
    }
    /**
     * Unsubscribe from a channel and remove it.
     */
    unsubscribe(channelName) {
        if (!this._channels[channelName])
            return this;
        this._rawSend({ event: 'amarwave:unsubscribe', data: { channel: channelName } });
        delete this._channels[channelName];
        return this;
    }
    /**
     * Get an already-subscribed channel by name. Returns `null` if not found.
     */
    channel(channelName) {
        var _a;
        return (_a = this._channels[channelName]) !== null && _a !== void 0 ? _a : null;
    }
    /**
     * Top-level publish shortcut. No need to hold a channel reference.
     * POSTs to the HTTP API. Returns `Promise<boolean>`.
     *
     * @example
     * aw.publish('public-chat', 'message', { user: 'Ali', text: 'Hi' });
     */
    publish(channelName, event, data) {
        return this._httpPublish(channelName, event, data);
    }
    bind(event, fn) {
        return super.bind(event, fn);
    }
    // ─── HTTP publish ─────────────────────────────────────────────────────────
    /** @internal Called by Channel.publish() and aw.publish(). */
    async _httpPublish(channelName, event, data) {
        const c = this._cfg;
        const proto = c.forceTLS ? 'https' : 'http';
        const defaultPort = c.forceTLS ? 443 : 80;
        const portStr = c.apiPort === defaultPort ? '' : `:${c.apiPort}`;
        const url = `${proto}://${c.apiHost}${portStr}${c.apiPath}`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_key: c.appKey,
                    app_secret: c.appSecret,
                    channel: channelName,
                    name: event,
                    data,
                }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                console.warn('[AmarWave] publish failed', res.status, j);
                return false;
            }
            return true;
        }
        catch (e) {
            console.warn('[AmarWave] publish error:', e.message);
            return false;
        }
    }
    // ─── WebSocket lifecycle ──────────────────────────────────────────────────
    _buildWsURL() {
        const c = this._cfg;
        const useTLS = c.forceTLS ||
            (Array.isArray(c.enabledTransports) &&
                c.enabledTransports.includes('wss') &&
                !c.enabledTransports.includes('ws'));
        const proto = useTLS ? 'wss' : 'ws';
        const port = useTLS ? c.wssPort : c.wsPort;
        const defaultPort = useTLS ? 443 : 80;
        const portStr = port === defaultPort ? '' : `:${port}`;
        return `${proto}://${c.wsHost}${portStr}${c.wsPath}?app_key=${encodeURIComponent(c.appKey)}`;
    }
    _openSocket() {
        this._setState('connecting');
        try {
            this._ws = new WebSocket(this._buildWsURL());
        }
        catch (e) {
            this._onError(e);
            return;
        }
        this._ws.onopen = () => this._onOpen();
        this._ws.onmessage = (e) => this._onRawMessage(e);
        this._ws.onerror = () => this._onError(new Error('WebSocket error'));
        this._ws.onclose = () => this._onClose();
    }
    _onOpen() {
        this._resetActivity();
    }
    _onRawMessage(raw) {
        this._resetActivity();
        let msg;
        try {
            msg = JSON.parse(raw.data);
        }
        catch (_a) {
            return;
        }
        if (typeof msg.data === 'string') {
            try {
                msg.data = JSON.parse(msg.data);
            }
            catch ( /* leave as string */_b) { /* leave as string */ }
        }
        this._handleMessage(msg);
    }
    _handleMessage(msg) {
        var _a, _b;
        switch (msg.event) {
            case 'amarwave:connection_established': {
                const d = msg.data;
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
                const errData = msg.data;
                const errMsg = typeof errData === 'object' ? errData.message : errData;
                this._onError(new Error(errMsg !== null && errMsg !== void 0 ? errMsg : 'Server error'));
                break;
            }
            case 'amarwave:pong':
                this._clearPongTimer();
                break;
            case 'amarwave_internal:subscription_succeeded': {
                const ch = this._channels[(_a = msg.channel) !== null && _a !== void 0 ? _a : ''];
                if (ch) {
                    ch.subscribed = true;
                    ch._fireEvent('subscribed', msg.data);
                    ch._fireEvent('amarwave_internal:subscription_succeeded', msg.data);
                    ch._flushQueue();
                }
                break;
            }
            case 'amarwave_internal:subscription_error': {
                const ch = this._channels[(_b = msg.channel) !== null && _b !== void 0 ? _b : ''];
                if (ch)
                    ch._fireEvent('error', msg.data);
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
    _onError(err) {
        this._emit('error', err);
        this.connection._fireState(this.state);
    }
    _onClose() {
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
        const delay = Math.min(this._cfg.reconnectDelay * Math.pow(2, this._retries), this._cfg.maxReconnectDelay);
        this._retries++;
        this._reTimer = setTimeout(() => this._openSocket(), delay);
    }
    // ─── Channel subscribe ────────────────────────────────────────────────────
    async _doSubscribe(ch) {
        const name = ch.name;
        const payload = {
            event: 'amarwave:subscribe',
            data: { channel: name },
        };
        try {
            if (name.startsWith('presence-')) {
                if (this._cfg.appSecret) {
                    const cd = JSON.stringify({ user_id: uid(), user_info: {} });
                    const sig = await hmacSHA256(this._cfg.appSecret, `${this.socketId}:${name}:${cd}`);
                    payload.data['auth'] = `${this._cfg.appKey}:${sig}`;
                    payload.data['channel_data'] = cd;
                }
                else {
                    await this._serverAuth(ch, payload);
                }
            }
            else if (name.startsWith('private-')) {
                if (this._cfg.appSecret) {
                    const sig = await hmacSHA256(this._cfg.appSecret, `${this.socketId}:${name}`);
                    payload.data['auth'] = `${this._cfg.appKey}:${sig}`;
                }
                else {
                    await this._serverAuth(ch, payload);
                }
            }
        }
        catch (e) {
            ch._fireEvent('error', e.message);
            return;
        }
        this._rawSend(payload);
    }
    async _serverAuth(ch, payload) {
        var _a, _b;
        const headers = Object.assign({ 'Content-Type': 'application/json' }, ((_b = (_a = this._cfg.auth) === null || _a === void 0 ? void 0 : _a.headers) !== null && _b !== void 0 ? _b : {}));
        const res = await fetch(this._cfg.authEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                socket_id: this.socketId,
                channel_name: ch.name,
            }),
        });
        if (!res.ok)
            throw new Error(`Auth failed: ${res.status}`);
        const json = await res.json();
        Object.assign(payload.data, json);
    }
    // ─── Utilities ────────────────────────────────────────────────────────────
    _rawSend(payload) {
        var _a;
        if (((_a = this._ws) === null || _a === void 0 ? void 0 : _a.readyState) === WebSocket.OPEN) {
            this._ws.send(JSON.stringify(payload));
        }
    }
    _setState(s) {
        this.state = s;
        this._emit(s);
        this.connection._fireState(s);
    }
    _resetActivity() {
        this._clearActivityTimer();
        this._actTimer = setTimeout(() => {
            const ping = this._cfg.disableStats
                ? { event: 'amarwave:ping', data: { stats: false } }
                : { event: 'amarwave:ping', data: {} };
            this._rawSend(ping);
            this._pongTimer = setTimeout(() => {
                var _a;
                console.warn('[AmarWave] Pong timeout — reconnecting');
                (_a = this._ws) === null || _a === void 0 ? void 0 : _a.close();
            }, this._cfg.pongTimeout);
        }, this._cfg.activityTimeout);
    }
    _clearActivityTimer() {
        if (this._actTimer !== null) {
            clearTimeout(this._actTimer);
            this._actTimer = null;
        }
    }
    _clearPongTimer() {
        if (this._pongTimer !== null) {
            clearTimeout(this._pongTimer);
            this._pongTimer = null;
        }
    }
    _clearTimers() {
        this._clearActivityTimer();
        this._clearPongTimer();
        if (this._reTimer !== null) {
            clearTimeout(this._reTimer);
            this._reTimer = null;
        }
    }
}

export { AmarWave, CLUSTERS, Channel, Connection, EventEmitter, AmarWave as default };
//# sourceMappingURL=amarwave.esm.js.map
