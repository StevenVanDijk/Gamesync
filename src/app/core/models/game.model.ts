export interface GameMetadata {
  communityScore?: number; // 0–100, derived from Steam review totals
  imageUrl?: string;
  yearPublished?: number;
  tags?: string[];
  fetchedAt?: number; // epoch ms – used for cache invalidation
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
}
