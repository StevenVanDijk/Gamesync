export type StoreType = 'steam' | 'epic' | 'gog';

export interface SteamConnectionConfig {
  apiKey: string;
  steamId: string;
}

export interface EpicConnectionConfig {
  /** Epic account ID returned after OAuth. */
  accountId: string;
  /** Display name of the connected Epic account. */
  displayName?: string;
  /** OAuth access token (may expire; refresh using refreshToken). */
  accessToken: string;
  /** OAuth refresh token for renewing the access token. */
  refreshToken: string;
  /** Unix timestamp (ms) when the access token expires. */
  expiresAt: number;
}

export interface GogConnectionConfig {
  /** GOG user ID. */
  userId: string;
  /** GOG username — used in the library stats API URL. */
  username: string;
  /** OAuth access token (may expire; refresh using refreshToken). */
  accessToken: string;
  /** OAuth refresh token for renewing the access token. */
  refreshToken: string;
  /** Unix timestamp (ms) when the access token expires. */
  expiresAt: number;
}

export type ConnectionConfig = SteamConnectionConfig | EpicConnectionConfig | GogConnectionConfig;

export interface StoreConnection {
  id: string;
  type: StoreType;
  /** Human-readable label, e.g. "My Steam Account" */
  label: string;
  config: ConnectionConfig;
  lastSyncedAt?: number;
}
