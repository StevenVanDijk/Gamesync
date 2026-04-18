export interface GameMetadata {
  communityScore?: number; // 0–100, derived from Steam review totals
  imageUrl?: string;
  yearPublished?: number;
  tags?: string[];
  fetchedAt?: number; // epoch ms – used for cache invalidation
}

/**
 * A Steam Store search result used as a matching candidate for non-Steam games.
 * Stored on the game when no exact title match was found so the user can pick.
 */
export interface SteamCandidate {
  appId: string;
  name: string;
  imageUrl?: string;
}

export interface Game {
  /** Globally unique: `{storeId}_{appId}` */
  id: string;
  /** Store-native application ID */
  appId: string;
  /** References StoreConnection.id */
  storeId: string;
  name: string;
  /** Total hours played (converted from store-native units) */
  hoursPlayed: number;
  metadata?: GameMetadata;
  /**
   * Steam Store search candidates for non-Steam games when no exact title
   * match was found automatically. Cleared once the user selects a match.
   */
  steamCandidates?: SteamCandidate[];
  /**
   * For games sourced from a CSV blob, the free-text store name from the
   * `source` column (e.g. "epic", "battlenet", "ubisoft").  Used for merge
   * matching and display only — not a StoreType.
   */
  csvSource?: string;
  /**
   * Whether the game is currently installed on the user's machine.
   * Only present when the source CSV includes an `IsInstalled` column
   * (e.g. Playnite exports). Absent for Steam/GOG connections.
   */
  isInstalled?: boolean;
}
