export type StoreType = 'steam' | 'gog' | 'blob';

export interface SteamConnectionConfig {
  apiKey: string;
  steamId: string;
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

export interface BlobConnectionConfig {
  /** Full Azure Blob SAS URL including query-string auth token. */
  url: string;
}

export type ConnectionConfig = SteamConnectionConfig | GogConnectionConfig | BlobConnectionConfig;

export interface StoreConnection {
  id: string;
  type: StoreType;
  /** Human-readable label, e.g. "My Steam Account" */
  label: string;
  config: ConnectionConfig;
  lastSyncedAt?: number;
}
