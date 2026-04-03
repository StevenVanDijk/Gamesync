export type StoreType = 'steam' | 'epic';

export interface SteamConnectionConfig {
  apiKey: string;
  steamId: string;
  /**
   * Optional CORS proxy URL prepended to Steam Web API requests.
   * Steam's Web API (api.steampowered.com) does not set CORS headers,
   * so a server-side proxy is required for browser-based requests.
   * Example: "https://my-proxy.example.com/steam"
   * Leave blank if running behind your own backend.
   */
  proxyUrl?: string;
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
