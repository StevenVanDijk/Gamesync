export type StoreType = 'steam' | 'epic';

export interface SteamConnectionConfig {
  apiKey: string;
  steamId: string;
}

export interface EpicConnectionConfig {
  /**
   * Raw JSON payload of Epic games (manual import).
   * Expected shape: Array<{ appId: string; name: string; hoursPlayed: number }>
   */
  gamesJson?: string;
}

export type ConnectionConfig = SteamConnectionConfig | EpicConnectionConfig;

export interface StoreConnection {
  id: string;
  type: StoreType;
  /** Human-readable label, e.g. "My Steam Account" */
  label: string;
  config: ConnectionConfig;
  lastSyncedAt?: number;
}
