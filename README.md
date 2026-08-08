# amarwave-js

Official JavaScript / TypeScript client for **AmarWave** — real-time WebSocket messaging for browsers, Node.js, and Deno.

Zero config · Full TypeScript support · Public, private & presence channels

[![npm](https://img.shields.io/npm/v/amarwave-js)](https://www.npmjs.com/package/amarwave-js)
[![CI](https://github.com/amarwave/amarwave-js/actions/workflows/ci.yml/badge.svg)](https://github.com/amarwave/amarwave-js/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/amarwave-js)](LICENSE)

---

## Install

```bash
npm install amarwave-js
```

---

## Table of Contents

- [CDN (Browser)](#cdn-browser)
- [React](#react)
- [Vue 3](#vue-3)
- [Svelte](#svelte)
- [Next.js](#nextjs)
- [Angular](#angular)
- [Node.js](#nodejs)
- [Deno](#deno)
- [Connection Events](#connection-events)
- [Publishing Events](#publishing-events)
- [Channel Types](#channel-types)
- [Configuration](#configuration)

---

## CDN (Browser)

No build step. Drop into any HTML file and open directly in a browser.

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/amarwave-js@2.0.7/dist/amarwave.min.js"></script>
</head>
<body>
<script>
  const aw = new AmarWave({
    appKey:    'YOUR_APP_KEY',
    appSecret: 'YOUR_APP_SECRET',
    cluster:   'default',
    forceTLS:  true,
  });

  aw.connection.bind('connected', () => {
    console.log('Connected:', aw.connection.socket_id);
  });

  const ch = aw.subscribe('public-chat');

  ch.bind('message', (data) => {
    console.log('📨', data.user, ':', data.text);
  });

  ch.bind('subscribed', async () => {
    await ch.publish('message', { user: 'Alice', text: 'Hello!' });
  });
</script>
</body>
</html>
```

---

## React

```bash
npm install amarwave-js
```

```tsx
// src/App.tsx
import { useEffect, useRef, useState } from 'react';
import AmarWave from 'amarwave-js';

const aw = new AmarWave({
  appKey:    'YOUR_APP_KEY',
  appSecret: 'YOUR_APP_SECRET',
  cluster:   'default',
  forceTLS:  true,
});

interface Msg { user: string; text: string }

export default function App() {
  const [state,    setState]    = useState(aw.connection.state);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text,     setText]     = useState('');
  const chRef = useRef(aw.subscribe('public-chat'));

  useEffect(() => {
    const ch = chRef.current;

    aw.connection.bind('connecting',   () => setState('connecting'));
    aw.connection.bind('connected',    () => { setState('connected'); setSocketId(aw.connection.socket_id); });
    aw.connection.bind('disconnected', () => { setState('disconnected'); setSocketId(null); });

    ch.bind<Msg>('message', (d) => setMessages(p => [...p, d]));

    return () => { aw.unsubscribe('public-chat'); };
  }, []);

  async function send() {
    if (!text.trim()) return;
    await chRef.current.publish('message', { user: 'React User', text });
    setText('');
  }

  return (
    <div>
      <p>Status: {state} {socketId && `| socket_id: ${socketId}`}</p>
      <ul>{messages.map((m, i) => <li key={i}><b>{m.user}:</b> {m.text}</li>)}</ul>
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
      <button onClick={send}>Send</button>
    </div>
  );
}
```

---

## Vue 3

```bash
npm install amarwave-js
```

```vue
<!-- src/App.vue -->
<template>
  <div>
    <p>Status: {{ state }} <span v-if="socketId">| socket_id: {{ socketId }}</span></p>
    <ul>
      <li v-for="(m, i) in messages" :key="i"><b>{{ m.user }}:</b> {{ m.text }}</li>
    </ul>
    <input v-model="text" @keydown.enter="send" placeholder="Type a message…" />
    <button @click="send">Send</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import AmarWave from 'amarwave-js';

interface Msg { user: string; text: string }

const aw = new AmarWave({
  appKey:    'YOUR_APP_KEY',
  appSecret: 'YOUR_APP_SECRET',
  cluster:   'default',
  forceTLS:  true,
});

const state    = ref(aw.connection.state);
const socketId = ref<string | null>(null);
const messages = ref<Msg[]>([]);
const text     = ref('');
const ch       = aw.subscribe('public-chat');

onMounted(() => {
  aw.connection.bind('connecting',   () => state.value = 'connecting');
  aw.connection.bind('connected',    () => { state.value = 'connected'; socketId.value = aw.connection.socket_id; });
  aw.connection.bind('disconnected', () => { state.value = 'disconnected'; socketId.value = null; });

  ch.bind<Msg>('message', (d) => messages.value.push(d));
});

onUnmounted(() => aw.unsubscribe('public-chat'));

async function send() {
  if (!text.value.trim()) return;
  await ch.publish('message', { user: 'Vue User', text: text.value });
  text.value = '';
}
</script>
```

---

## Svelte

```bash
npm install amarwave-js
```

```svelte
<!-- src/App.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import AmarWave from 'amarwave-js';

  const aw = new AmarWave({
    appKey:    'YOUR_APP_KEY',
    appSecret: 'YOUR_APP_SECRET',
    cluster:   'default',
    forceTLS:  true,
  });

  let state    = aw.connection.state;
  let socketId = null;
  let messages = [];
  let text     = '';
  const ch     = aw.subscribe('public-chat');

  onMount(() => {
    aw.connection.bind('connecting',   () => state = 'connecting');
    aw.connection.bind('connected',    () => { state = 'connected'; socketId = aw.connection.socket_id; });
    aw.connection.bind('disconnected', () => { state = 'disconnected'; socketId = null; });

    ch.bind('message', (d) => messages = [...messages, d]);
  });

  onDestroy(() => aw.unsubscribe('public-chat'));

  async function send() {
    if (!text.trim()) return;
    await ch.publish('message', { user: 'Svelte User', text });
    text = '';
  }
</script>

<p>Status: {state} {socketId ? `| socket_id: ${socketId}` : ''}</p>
<ul>{#each messages as m}<li><b>{m.user}:</b> {m.text}</li>{/each}</ul>
<input bind:value={text} on:keydown={e => e.key === 'Enter' && send()} placeholder="Type a message…" />
<button on:click={send}>Send</button>
```

---

## Next.js

```bash
npm install amarwave-js
```

```tsx
// app/components/Chat.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import AmarWave from 'amarwave-js';

// Singleton — prevents re-creating on every render
let _aw: AmarWave | null = null;
function getAW() {
  if (!_aw) _aw = new AmarWave({
    appKey:    'YOUR_APP_KEY',
    appSecret: 'YOUR_APP_SECRET',
    cluster:   'default',
    forceTLS:  true,
  });
  return _aw;
}

interface Msg { user: string; text: string }

export default function Chat() {
  const [state,    setState]    = useState('initialized');
  const [socketId, setSocketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text,     setText]     = useState('');
  const chRef = useRef<ReturnType<AmarWave['subscribe']> | null>(null);

  useEffect(() => {
    const aw = getAW();
    const ch = aw.subscribe('public-chat');
    chRef.current = ch;

    aw.connection.bind('connecting',   () => setState('connecting'));
    aw.connection.bind('connected',    () => { setState('connected'); setSocketId(aw.connection.socket_id); });
    aw.connection.bind('disconnected', () => { setState('disconnected'); setSocketId(null); });

    ch.bind<Msg>('message', (d) => setMessages(p => [...p, d]));

    return () => { aw.unsubscribe('public-chat'); };
  }, []);

  async function send() {
    if (!text.trim() || !chRef.current) return;
    await chRef.current.publish('message', { user: 'Next.js User', text });
    setText('');
  }

  return (
    <div>
      <p>Status: {state} {socketId && `| socket_id: ${socketId}`}</p>
      <ul>{messages.map((m, i) => <li key={i}><b>{m.user}:</b> {m.text}</li>)}</ul>
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
      <button onClick={send}>Send</button>
    </div>
  );
}
```

```tsx
// app/page.tsx
import Chat from './components/Chat';
export default function Page() { return <Chat />; }
```

---

## Angular

```bash
npm install amarwave-js
```

```typescript
// src/app/app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import AmarWave from 'amarwave-js';

const aw = new AmarWave({
  appKey:    'YOUR_APP_KEY',
  appSecret: 'YOUR_APP_SECRET',
  cluster:   'default',
  forceTLS:  true,
});

@Component({
  selector: 'app-root',
  template: `
    <p>Status: {{ state }} <span *ngIf="socketId">| socket_id: {{ socketId }}</span></p>
    <ul>
      <li *ngFor="let m of messages"><b>{{ m.user }}:</b> {{ m.text }}</li>
    </ul>
    <input [(ngModel)]="text" (keydown.enter)="send()" placeholder="Type a message…" />
    <button (click)="send()">Send</button>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  state    = aw.connection.state;
  socketId: string | null = null;
  messages: { user: string; text: string }[] = [];
  text = '';
  private ch = aw.subscribe('public-chat');

  ngOnInit() {
    aw.connection.bind('connecting',   () => this.state = 'connecting');
    aw.connection.bind('connected',    () => { this.state = 'connected'; this.socketId = aw.connection.socket_id; });
    aw.connection.bind('disconnected', () => { this.state = 'disconnected'; this.socketId = null; });
    aw.connection.bind('error', (e: unknown) => console.error('[AmarWave]', (e as Error).message));

    this.ch.bind('message', (d: { user: string; text: string }) => this.messages.push(d));
  }

  ngOnDestroy() { aw.unsubscribe('public-chat'); }

  async send() {
    if (!this.text.trim()) return;
    await this.ch.publish('message', { user: 'Angular User', text: this.text });
    this.text = '';
  }
}
```

---

## Node.js

Works out of the box — no WebSocket polyfill needed.

- **Node.js 21+**: uses the built-in global `WebSocket`
- **Node.js < 21**: `amarwave-js` auto-injects the `ws` polyfill (install `ws` alongside)

**ESM:**
```js
// app.mjs
import AmarWave from 'amarwave-js';

const aw = new AmarWave({
  appKey:    'YOUR_APP_KEY',
  appSecret: 'YOUR_APP_SECRET',
  cluster:   'default',
  forceTLS:  true,
});

aw.connection.bind('connected', () => console.log('Connected:', aw.connection.socket_id));

const ch = aw.subscribe('public-chat');

ch.bind('subscribed', async () => {
  await ch.publish('message', { user: 'Server', text: 'Hello from Node.js!' });
});

ch.bind('message', (data) => console.log('📨', data));
```

**CJS:**
```js
// app.cjs
const { AmarWave } = require('amarwave-js');

const aw = new AmarWave({
  appKey:    'YOUR_APP_KEY',
  appSecret: 'YOUR_APP_SECRET',
  cluster:   'default',
  forceTLS:  true,
});

aw.connection.bind('connected', () => console.log('Connected:', aw.connection.socket_id));

const ch = aw.subscribe('public-chat');

ch.bind('subscribed', async () => {
  await ch.publish('message', { user: 'Server', text: 'Hello from Node.js!' });
});

ch.bind('message', (data) => console.log('📨', data));
```

---

## Deno

No install needed — import directly from npm.

```ts
// app.ts
import AmarWave from 'npm:amarwave-js@2.0.7';

const aw = new AmarWave({
  appKey:    'YOUR_APP_KEY',
  appSecret: 'YOUR_APP_SECRET',
  cluster:   'default',
  forceTLS:  true,
});

aw.connection.bind('connected', () => console.log('Connected:', aw.connection.socket_id));

const ch = aw.subscribe('public-chat');

ch.bind('subscribed', async () => {
  await ch.publish('message', { user: 'Deno', text: 'Hello from Deno!' });
});

ch.bind('message', (data) => console.log('📨', data));
```

```bash
deno run --allow-net app.ts
```

---

## Connection Events

```ts
aw.connection.bind('connecting',   () => console.log('Connecting…'));
aw.connection.bind('connected',    () => console.log('Connected:', aw.connection.socket_id));
aw.connection.bind('disconnected', () => console.log('Disconnected — retrying…'));
aw.connection.bind('error',        (e) => console.error('Error:', e.message));

// Read current state at any time
console.log(aw.connection.state);      // 'initialized' | 'connecting' | 'connected' | 'disconnected'
console.log(aw.connection.socket_id);  // string | null
```

---

## Publishing Events

**From the client:**
```ts
// via channel
await ch.publish('message', { user: 'Alice', text: 'Hello!' });

// top-level shortcut
await aw.publish('public-chat', 'message', { user: 'Alice', text: 'Hello!' });
```

**From the server (HTTP API):**
```bash
curl -X POST https://amarwave.com/api/v1/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "app_key":    "YOUR_APP_KEY",
    "app_secret": "YOUR_APP_SECRET",
    "channel":    "public-chat",
    "name":       "message",
    "data":       { "user": "Server", "text": "Hello from server!" }
  }'
```

---

## Channel Types

| Prefix | Type | Auth required |
|---|---|---|
| *(none)* | Public | No |
| `private-` | Private | Yes — HMAC signed |
| `presence-` | Presence | Yes — tracks members |

```ts
aw.subscribe('public-chat');     // public
aw.subscribe('private-orders');  // private — needs appSecret or authEndpoint
aw.subscribe('presence-lobby');  // presence — needs appSecret or authEndpoint
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `appKey` | `string` | — | App key **(required)** |
| `appSecret` | `string` | — | App secret — for client-side HMAC auth |
| `cluster` | `string` | `"default"` | `"default"` → amarwave.com |
| `forceTLS` | `boolean` | `false` | Force `wss://` + `https://` |
| `apiPath` | `string` | `"/api/v1/trigger"` | Trigger endpoint path |
| `wsPath` | `string` | `"/ws"` | WebSocket upgrade path |
| `authEndpoint` | `string` | `"/broadcasting/auth"` | Server URL for private/presence auth |
| `auth.headers` | `object` | `{}` | Extra headers sent to auth endpoint |
| `maxRetries` | `number` | `5` | Max reconnect attempts |
| `reconnectDelay` | `number` | `1000` | Base delay ms (exponential backoff) |
| `maxReconnectDelay` | `number` | `30000` | Max delay ms |

---

## CI / CD

Releases are published automatically to npm when a `v*` tag is pushed to `main`.

```bash
# bump version, tag, push → CI builds and publishes
npm version patch   # or minor / major
git push origin main --tags
```

The publish job uses npm's **OIDC Trusted Publisher** — no token is stored in GitHub secrets.

---

## License

MIT © AmarWave
