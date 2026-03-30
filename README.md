# amarwave-js

Official JavaScript / TypeScript client for [AmarWave](https://amarwave.io) — real-time WebSocket messaging for browsers and Node.js.

Zero external dependencies. Full TypeScript types. Supports public, private, and presence channels.

---

## Installation

```bash
npm install amarwave-js
```

Or via CDN:

```html
<script src="https://amarwave.com/cdn/amarwave.min.js"></script>
```

---

## Quick Start

```ts
import AmarWave from 'amarwave-js';

const aw = new AmarWave({
  appKey:    'your-app-key',
  appSecret: 'your-app-secret',
});

aw.connection.bind('connected', () => {
  console.log('Connected to AmarWave!');
});

const ch = aw.subscribe('public-chat');

ch.bind('message', (data) => {
  console.log(data.user, data.text);
});

ch.publish('message', { user: 'Ali', text: 'Hello!' });
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `appKey` | string | `""` | Your app key **(required)** |
| `appSecret` | string | `""` | App secret for client-side HMAC auth (dev only) |
| `forceTLS` | boolean | `false` | Force WSS + HTTPS |
| `cluster` | string | `"default"` | Named cluster (`"ap1"`, `"ap2"`, `"eu"`, `"us"`) or hostname |
| `authEndpoint` | string | `"/broadcasting/auth"` | Server auth URL for private/presence channels |
| `auth.headers` | object | `{}` | Headers sent to auth endpoint |
| `reconnectDelay` | number | `1000` | Base reconnect delay in ms (exponential backoff) |
| `maxReconnectDelay` | number | `30000` | Max reconnect delay in ms |
| `maxRetries` | number | `5` | Max retry attempts (0 = infinite) |
| `activityTimeout` | number | `120000` | Ms of inactivity before sending ping |
| `pongTimeout` | number | `30000` | Ms to wait for pong before reconnecting |
| `enabledTransports` | string[] | `["ws"]` | `["ws"]`, `["wss"]`, or both |

---

## Channel API

```ts
const ch = aw.subscribe('public-chat');

ch.bind('message', handler);          // listen for event
ch.bind_global((event, data) => {});  // listen for all events
ch.unbind('message', handler);        // remove specific listener
ch.unbind('message');                 // remove all listeners for event

await ch.publish('message', { text: 'Hi' }); // POST via HTTP API → Promise<boolean>

ch.name;        // "public-chat"
ch.subscribed;  // true when server confirmed

aw.unsubscribe('public-chat');        // leave channel
```

Top-level publish shortcut (no channel reference needed):

```ts
await aw.publish('public-chat', 'message', { text: 'Hi' });
```

---

## Connection Events

```ts
aw.bind('connecting',   () => console.log('Connecting…'));
aw.bind('connected',    () => console.log('Connected:', aw.socketId));
aw.bind('disconnected', () => console.log('Disconnected'));
aw.bind('error',        (err) => console.error('Error:', err));

aw.connect();     // explicit connect (auto-called on first subscribe)
aw.disconnect();  // close WebSocket, no auto-reconnect
```

---

## Private Channels

Private channels (`private-`) require HMAC authentication.

**Development** (client-side secret — never expose in production):

```ts
const aw = new AmarWave({ appKey: 'KEY', appSecret: 'SECRET' });
const ch = aw.subscribe('private-orders');  // auto-signed
```

**Production** (server-side auth endpoint):

```ts
const aw = new AmarWave({
  appKey:       'KEY',
  authEndpoint: 'https://yourapp.io/api/broadcasting/auth',
  auth: {
    headers: { Authorization: `Bearer ${token}` },
  },
});

const ch = aw.subscribe('private-orders');
```

---

## Presence Channels

```ts
const ch = aw.subscribe('presence-lobby');

ch.bind('subscribed', (data) => {
  console.log('Members:', data);
});

ch.bind('pusher_internal:member_added', (data) => {
  console.log('Joined:', data);
});

ch.bind('pusher_internal:member_removed', (data) => {
  console.log('Left:', data);
});
```

---

## Channel Naming Conventions

| Prefix | Type | Notes |
|---|---|---|
| (none) | Public | Anyone can subscribe |
| `private-` | Private | Requires HMAC auth from your server |
| `presence-` | Presence | Tracks online users; requires auth |

Examples: `"chat-room-1"`, `"private-user-42"`, `"presence-lobby"`

---

## Build

```bash
npm install
npm run build
```

Output files in `dist/`:
- `amarwave.cjs.js` — CommonJS
- `amarwave.esm.js` — ES module
- `amarwave.umd.js` — UMD bundle (browser)
- `amarwave.min.js` — Minified UMD
- `index.d.ts` — TypeScript declarations

---

## License

MIT © AmarWave
