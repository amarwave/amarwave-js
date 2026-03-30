import type { ClusterName } from './types';

interface ClusterEntry {
  ws:  string;
  wss: string;
  api: string;
}

/**
 * Maps cluster shorthand names to their WS and API base URLs.
 * Both "default" and "local" resolve to localhost for development.
 */
export const CLUSTERS: Partial<Record<ClusterName, ClusterEntry>> = {
  default: {
    ws:  'ws://amarwave.com',
    wss: 'wss://amarwave.com',
    api: 'https://amarwave.com',
  },
  local: {
    ws:  'ws://localhost:3001',
    wss: 'wss://localhost:3001',
    api: 'http://localhost:8000',
  },
  ap1: {
    ws:  'ws://amarwave.com',
    wss: 'wss://amarwave.com',
    api: 'https://amarwave.com',
  },
  ap2: {
    ws:  'ws://amarwave.com',
    wss: 'wss://amarwave.com',
    api: 'https://amarwave.com',
  },
  eu: {
    ws:  'ws://amarwave.com',
    wss: 'wss://amarwave.com',
    api: 'https://amarwave.com',
  },
  us: {
    ws:  'ws://amarwave.com',
    wss: 'wss://amarwave.com',
    api: 'https://amarwave.com',
  },
};

export type { ClusterEntry };
