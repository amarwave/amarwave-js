# amarwave-js

Official JavaScript / TypeScript client for **AmarWave** — real-time WebSocket messaging for browsers and Node.js.

Zero external dependencies · Full TypeScript support · Public, private & presence channels

[![npm](https://img.shields.io/npm/v/amarwave-js)](https://www.npmjs.com/package/amarwave-js)
[![license](https://img.shields.io/npm/l/amarwave-js)](LICENSE)

---

## Table of Contents

- [Installation](#installation)
  - [CDN (Script Tag)](#cdn-script-tag)
  - [npm / yarn / pnpm](#npm--yarn--pnpm)
  - [React](#react)
  - [Vue 3](#vue-3)
  - [Angular](#angular)
  - [Next.js](#nextjs)
  - [Svelte / SvelteKit](#svelte--sveltekit)
  - [Node.js (server-side)](#nodejs-server-side)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Channel API](#channel-api)
- [Connection Events](#connection-events)
- [Channel Types](#channel-types)
- [Private Channels](#private-channels)
- [Presence Channels](#presence-channels)
- [Publishing Events](#publishing-events)

---

## Installation

### CDN (Script Tag)

The fastest way — no build step required. Drop this in any HTML file:

```html
<!-- Latest via unpkg -->
<script src="https://unpkg.com/amarwave-js@latest/dist/amarwave.min.js"></script>

<!-- Pinned version (recommended for production) -->
<script src="https://unpkg.com/amarwave-js@2.0.3/dist/amarwave.min.js"></script>

<!-- jsDelivr alternative -->
<script src="https://cdn.jsdelivr.net/npm/amarwave-js@2.0.3/dist/amarwave.min.js"></script>
```

After the script loads, `window.AmarWave` is available:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/amarwave-js@2.0.3/dist/amarwave.min.js"></script>
</head>
<body>
<script>
  const aw = new AmarWave({
    appKey:    '51e72f30efd5325a8f8b9ca9a8195525',
    appSecret: '68f977e06f67b23467e2827808fbb61487c42cad680d31fe7f714c436464fc8b',
    cluster:   'default',
  });

  const ch = aw.subscribe('public-chat');

  ch.bind('message', (data) => {
    console.log('New message:', data);
  });

  // Publish after subscribed
  ch.bind('subscribed', () => {
    ch.publish('message', { user: 'Ali', text: 'Hello from CDN!' });
  });
</script>
</body>
</html>
```

---

### npm / yarn / pnpm

```bash
npm install amarwave-js
# or
yarn add amarwave-js
# or
pnpm add amarwave-js
```

```ts
import AmarWave from 'amarwave-js';

const aw = new AmarWave({
  appKey:    '51e72f30efd5325a8f8b9ca9a8195525',
  appSecret: '68f977e06f67b23467e2827808fbb61487c42cad680d31fe7f714c436464fc8b',
  cluster:   'default',
});

const ch = aw.subscribe('public-chat');
ch.bind('message', (data) => console.log(data));
```

---

### React

```bash
npm install amarwave-js
```

```tsx
// src/hooks/useAmarWave.ts
import { useEffect, useRef } from 'react';
import AmarWave, { Channel } from 'amarwave-js';

const client = new AmarWave({
  appKey:    '51e72f30efd5325a8f8b9ca9a8195525',
  appSecret: '68f977e06f67b23467e2827808fbb61487c42cad680d31fe7f714c436464fc8b',
  cluster:   'default',
});

export function useChannel<T = unknown>(
  channelName: string,
  event: string,
  handler: (data: T) => void,
) {
  useEffect(() => {
    const ch: Channel = client.subscribe(channelName);
    ch.bind(event, handler);
    return () => {
      ch.unbind(event, handler);
      client.unsubscribe(channelName);
    };
  }, [channelName, event, handler]);
}
```

```tsx
// src/components/Chat.tsx
import { useState } from 'react';
import { useChannel } from '../hooks/useAmarWave';

interface Message { user: string; text: string }

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);

  useChannel<Message>('public-chat', 'message', (data) => {
    setMessages(prev => [...prev, data]);
  });

  return (
    <ul>
      {messages.map((m, i) => (
        <li key={i}><b>{m.user}:</b> {m.text}</li>
      ))}
    </ul>
  );
}
```

---

### Vue 3

```bash
npm install amarwave-js
```

```ts
// src/plugins/amarwave.ts
import { App, InjectionKey } from 'vue';
import AmarWave from 'amarwave-js';

export const AmarWaveKey: InjectionKey<AmarWave> = Symbol('AmarWave');

export const amarwavePlugin = {
  install(app: App) {
    const client = new AmarWave({
      appKey:    '51e72f30efd5325a8f8b9ca9a8195525',
      appSecret: '68f977e06f67b23467e2827808fbb61487c42cad680d31fe7f714c436464fc8b',
      cluster:   'default',
    });
    app.provide(AmarWaveKey, client);
  },
};
```

```ts
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import { amarwavePlugin } from './plugins/amarwave';

createApp(App).use(amarwavePlugin).mount('#app');
```

```vue
<!-- src/components/Chat.vue -->
<template>
  <ul>
    <li v-for="(m, i) in messages" :key="i">
      <b>{{ m.user }}:</b> {{ m.text }}
    </li>
  </ul>
</template>

<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from 'vue';
import { AmarWaveKey } from '../plugins/amarwave';
import type { Channel } from 'amarwave-js';

interface Message { user: string; text: string }

const aw  = inject(AmarWaveKey)!;
const messages = ref<Message[]>([]);
let ch: Channel;

onMounted(() => {
  ch = aw.subscribe('public-chat');
  ch.bind<Message>('message', (data) => messages.value.push(data));
});

onUnmounted(() => aw.unsubscribe('public-chat'));
</script>
```

---

### Angular

```bash
npm install amarwave-js
```

```ts
// src/app/services/amarwave.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import AmarWave, { Channel } from 'amarwave-js';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AmarWaveService implements OnDestroy {
  private client = new AmarWave({
    appKey:    '51e72f30efd5325a8f8b9ca9a8195525',
    appSecret: '68f977e06f67b23467e2827808fbb61487c42cad680d31fe7f714c436464fc8b',
    cluster:   'default',
  });

  channel(name: string): Channel {
    return this.client.subscribe(name);
  }

  listen<T>(channelName: string, event: string): Observable<T> {
    const subject = new Subject<T>();
    const ch = this.client.subscribe(channelName);
    ch.bind<T>(event, (data) => subject.next(data));
    return subject.asObservable();
  }

  ngOnDestroy() {
    this.client.disconnect();
  }
}
```

```ts
// src/app/components/chat.component.ts
import { Component, OnInit } from '@angular/core';
import { AmarWaveService } from '../services/amarwave.service';

@Component({
  selector: 'app-chat',
  template: `
    <ul>
      <li *ngFor="let m of messages"><b>{{ m.user }}:</b> {{ m.text }}</li>
    </ul>
  `,
})
export class ChatComponent implements OnInit {
  messages: { user: string; text: string }[] = [];

  constructor(private aw: AmarWaveService) {}

  ngOnInit() {
    this.aw.listen<{ user: string; text: string }>('public-chat', 'message')
      .subscribe(data => this.messages.push(data));
  }
}
```

---

### Next.js

```bash
npm install amarwave-js
```

Use a singleton client (avoid re-creating on every render):

```ts
// lib/amarwave.ts
import AmarWave from 'amarwave-js';

let client: AmarWave | null = null;

export function getAmarWave(): AmarWave {
  if (typeof window === 'undefined') {
    throw new Error('AmarWave client can only be used in the browser');
  }
  if (!client) {
    client = new AmarWave({
      appKey:    '51e72f30efd5325a8f8b9ca9a8195525',
      appSecret: '68f977e06f67b23467e2827808fbb61487c42cad680d31fe7f714c436464fc8b',
      cluster:   'default',
    });
  }
  return client;
}
```

```tsx
// app/components/Chat.tsx  (Next.js App Router — client component)
'use client';

import { useEffect, useState } from 'react';
import { getAmarWave } from '@/lib/amarwave';

interface Message { user: string; text: string }

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const aw = getAmarWave();
    const ch = aw.subscribe('public-chat');
    ch.bind<Message>('message', (data) => setMessages(p => [...p, data]));
    return () => aw.unsubscribe('public-chat');
  }, []);

  return (
    <ul>
      {messages.map((m, i) => <li key={i}><b>{m.user}:</b> {m.text}</li>)}
    </ul>
  );
}
```

---

### Svelte / SvelteKit

```bash
npm install amarwave-js
```

```ts
// src/lib/amarwave.ts
import AmarWave from 'amarwave-js';
import { browser } from '$app/environment';

export const aw = browser
  ? new AmarWave({
      appKey:    '51e72f30efd5325a8f8b9ca9a8195525',
      appSecret: '68f977e06f67b23467e2827808fbb61487c42cad680d31fe7f714c436464fc8b',
      cluster:   'default',
    })
  : null;
```

```svelte
<!-- src/routes/chat/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { aw } from '$lib/amarwave';

  interface Message { user: string; text: string }
  let messages: Message[] = [];

  onMount(() => {
    const ch = aw?.subscribe('public-chat');
    ch?.bind<Message>('message', (data) => (messages = [...messages, data]));
  });

  onDestroy(() => aw?.unsubscribe('public-chat'));
</script>

<ul>
  {#each messages as m}
    <li><b>{m.user}:</b> {m.text}</li>
  {/each}
</ul>
```

---

### Node.js (server-side)

> AmarWave uses the browser `WebSocket` API. In Node.js, provide a polyfill.

```bash
npm install amarwave-js ws
```

```js
// node-example.js (CJS)
const { AmarWave } = require('amarwave-js');
const WebSocket    = require('ws');

// Polyfill the global WebSocket
globalThis.WebSocket = WebSocket;

const aw = new AmarWave({
  appKey:    '51e72f30efd5325a8f8b9ca9a8195525',
  appSecret: '68f977e06f67b23467e2827808fbb61487c42cad680d31fe7f714c436464fc8b',
  cluster:   'default',
});

aw.bind('connected', () => console.log('Connected! socketId:', aw.socketId));

const ch = aw.subscribe('public-chat');
ch.bind('message', (data) => console.log('Received:', data));
ch.bind('subscribed', async () => {
  const ok = await ch.publish('message', { user: 'Node', text: 'Hello!' });
  console.log('Published:', ok);
});
```

---

## Quick Start

```ts
import AmarWave from 'amarwave-js';

const aw = new AmarWave({
  appKey:    'YOUR_APP_KEY',
  appSecret: 'YOUR_APP_SECRET', // dev only — use authEndpoint in production
  cluster:   'default',         // or 'local' for localhost development
});

// Listen for connection events
aw.bind('connected',    () => console.log('Connected:', aw.socketId));
aw.bind('disconnected', () => console.log('Disconnected'));
aw.bind('error',        (err) => console.error(err));

// Subscribe and listen
const ch = aw.subscribe('public-chat');

ch.bind('message', (data) => {
  console.log('New message:', data);
});

// Publish after subscription confirmed
ch.bind('subscribed', async () => {
  const ok = await ch.publish('message', { user: 'Ali', text: 'Hello!' });
  console.log('Published:', ok);
});
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `appKey` | `string` | `""` | Your app key **(required)** |
| `appSecret` | `string` | `""` | App secret for client-side HMAC — dev only |
| `cluster` | `string` | `"default"` | `"default"`, `"local"`, `"ap1"`, `"ap2"`, `"eu"`, `"us"` or hostname |
| `wsHost` | `string` | `"localhost"` | Override WS server hostname |
| `wsPort` | `number` | `3001` | WS plain port |
| `wssPort` | `number` | `443` | WS TLS port |
| `apiHost` | `string` | same as `wsHost` | HTTP API hostname for publishing |
| `apiPort` | `number` | `8000` | HTTP API port |
| `apiPath` | `string` | `"/api/v1/trigger"` | HTTP trigger endpoint path |
| `wsPath` | `string` | `"/ws"` | WebSocket upgrade path |
| `forceTLS` | `boolean` | `false` | Force WSS + HTTPS |
| `authEndpoint` | `string` | `"/broadcasting/auth"` | Server auth URL for private/presence channels |
| `auth.headers` | `object` | `{}` | Extra headers sent to auth endpoint |
| `reconnectDelay` | `number` | `1000` | Base reconnect delay ms (exponential backoff) |
| `maxReconnectDelay` | `number` | `30000` | Max reconnect delay ms |
| `maxRetries` | `number` | `5` | Max retries (0 = infinite) |
| `activityTimeout` | `number` | `120000` | Inactivity ms before ping |
| `pongTimeout` | `number` | `30000` | Ms to wait for pong before reconnecting |
| `enabledTransports` | `string[]` | `["ws"]` | `["ws"]`, `["wss"]`, or both |

**Cluster shortcuts:**

| Name | Description |
|---|---|
| `default` | Production cluster (`amarwave.com`) |
| `local` | Local dev (`ws://localhost:3001`, `http://localhost:8000`) |
| `ap1` / `ap2` | Asia-Pacific |
| `eu` | Europe |
| `us` | United States |

---

## Channel API

```ts
const ch = aw.subscribe('public-chat');

// Listen for events
ch.bind('message', handler);           // specific event
ch.bind_global((event, data) => {});   // all events on this channel

// Remove listeners
ch.unbind('message', handler);         // remove specific listener
ch.unbind('message');                  // remove all listeners for 'message'

// Publish via HTTP API → returns Promise<boolean>
const ok = await ch.publish('message', { text: 'Hi' });
// or alias:
await ch.trigger('message', { text: 'Hi' });

// Properties
ch.name;        // "public-chat"
ch.subscribed;  // true once server confirmed

// Unsubscribe
aw.unsubscribe('public-chat');
```

Top-level publish shortcut:

```ts
await aw.publish('public-chat', 'message', { text: 'Hi' });
```

---

## Connection Events

```ts
aw.bind('connecting',   () => console.log('Connecting…'));
aw.bind('connected',    () => console.log('Connected, socketId:', aw.socketId));
aw.bind('disconnected', () => console.log('Disconnected'));
aw.bind('error',        (err: Error) => console.error('Error:', err));

aw.connect();     // explicit connect (auto-called by subscribe)
aw.disconnect();  // close, no auto-reconnect
```

---

## Channel Types

| Prefix | Type | Notes |
|---|---|---|
| (none) | Public | Anyone can subscribe |
| `private-` | Private | Requires HMAC auth |
| `presence-` | Presence | Tracks online members; requires auth |

Examples: `"chat-room-1"`, `"private-orders-42"`, `"presence-lobby"`

---

## Private Channels

Private channels require HMAC authentication.

**Development** (client-side secret):

```ts
const aw = new AmarWave({
  appKey:    'KEY',
  appSecret: 'SECRET', // signs the subscription locally
  cluster:   'default',
});

const ch = aw.subscribe('private-orders'); // auto-signed
```

**Production** (server-side auth endpoint):

```ts
const aw = new AmarWave({
  appKey:       'KEY',
  cluster:      'default',
  authEndpoint: 'https://yourapi.com/broadcasting/auth',
  auth: {
    headers: { Authorization: `Bearer ${userToken}` },
  },
});

const ch = aw.subscribe('private-orders');
```

Your server endpoint must respond with:

```json
{ "auth": "appKey:hmacSignature" }
```

---

## Presence Channels

Presence channels track connected members. They also require auth.

```ts
const ch = aw.subscribe('presence-lobby');

ch.bind('subscribed', (data) => {
  console.log('Current members:', data);
});

ch.bind('amarwave_internal:member_added', (data) => {
  console.log('User joined:', data);
});

ch.bind('amarwave_internal:member_removed', (data) => {
  console.log('User left:', data);
});
```

---

## Publishing Events

Events can be published from both client and server.

**From the client (via channel):**

```ts
await ch.publish('message', { user: 'Ali', text: 'Hello' });
```

**From the client (top-level shortcut):**

```ts
await aw.publish('public-chat', 'message', { user: 'Ali', text: 'Hello' });
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

## Build from Source

```bash
git clone https://github.com/amarwave/amarwave-js.git
cd amarwave-js
npm install
npm run build
```

Output in `dist/`:
| File | Format | Use case |
|---|---|---|
| `amarwave.cjs` | CommonJS | Node.js `require()` |
| `amarwave.esm.js` | ES Module | Bundlers (webpack, Vite, Rollup) |
| `amarwave.umd.js` | UMD | Browser `<script>` tag |
| `amarwave.min.js` | UMD minified | CDN / production |
| `index.d.ts` | TypeScript | Type declarations |

---

## License

MIT © AmarWave
