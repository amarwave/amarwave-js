import type { ClusterName } from './types';
interface ClusterEntry {
    ws: string;
    wss: string;
    api: string;
}
/**
 * Maps cluster shorthand names to their WS and API base URLs.
 * Both "default" and "local" resolve to localhost for development.
 */
export declare const CLUSTERS: Partial<Record<ClusterName, ClusterEntry>>;
export type { ClusterEntry };
