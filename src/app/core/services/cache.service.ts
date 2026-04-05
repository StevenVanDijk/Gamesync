import { Injectable } from '@angular/core';

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // 0 = permanent (never expires)
}

/** Default TTL for owned-games lists (24 h). */
export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Pass as ttlMs to store an entry that never expires. */
export const PERMANENT_CACHE = 0;

@Injectable({ providedIn: 'root' })
export class CacheService {
  private readonly PREFIX = 'gamesync_cache_';

  set<T>(key: string, data: T, ttlMs = DEFAULT_CACHE_TTL_MS): void {
    const expiresAt = ttlMs === PERMANENT_CACHE ? PERMANENT_CACHE : Date.now() + ttlMs;
    const entry: CacheEntry<T> = { data, expiresAt };
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(entry));
    } catch {
      // localStorage may be full – silently skip caching
    }
  }

  get<T>(key: string): T | null {
    const raw = localStorage.getItem(this.PREFIX + key);
    if (!raw) return null;
    try {
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (entry.expiresAt !== PERMANENT_CACHE && Date.now() > entry.expiresAt) {
        localStorage.removeItem(this.PREFIX + key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }

  delete(key: string): void {
    localStorage.removeItem(this.PREFIX + key);
  }

  clear(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }
}
