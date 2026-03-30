/**
 * AmarWave JS Client v2.0.0
 * Real-time WebSocket client for AmarWave servers.
 *
 * @example
 * import AmarWave from 'amarwave';
 *
 * const aw = new AmarWave({ appKey: 'YOUR_KEY', appSecret: 'YOUR_SECRET' });
 * const ch = aw.subscribe('public-chat');
 * ch.bind('message', console.log);
 * ch.publish('message', { user: 'Ali', text: 'Hello!' });
 */
export { AmarWave } from './AmarWave';
export { Channel } from './Channel';
export { Connection } from './Connection';
export { EventEmitter } from './EventEmitter';
export { CLUSTERS } from './clusters';
export type { AmarWaveConfig, ResolvedConfig, AuthOptions, ConnectionState, ClusterName, Transport, AmarWaveEventMap, ChannelEventMap, EventListener, GlobalEventListener, } from './types';
export { AmarWave as default } from './AmarWave';
