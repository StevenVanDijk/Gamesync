import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, map, switchMap } from 'rxjs';
import { CacheService, DEFAULT_CACHE_TTL_MS } from './cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { Game, GameMetadata } from '../models/game.model';
import { SteamConnectionConfig } from '../models/store-connection.model';

// ── Raw Steam API response shapes ────────────────────────────────────────────

interface SteamOwnedGame {
  appid: number;
  name?: string;
  playtime_forever: number; // total minutes
  img_icon_url?: string;
}

interface SteamOwnedGamesResponse {
  response: {
    games?: SteamOwnedGame[];
    game_count?: number;
  };
}

interface SteamAppDetailsData {
  name: string;
  header_image: string;
  genres?: Array<{ id: string; description: string }>;
  categories?: Array<{ id: number; description: string }>;
  release_date?: { coming_soon: boolean; date: string };
  metacritic?: { score: number };
}

interface SteamAppDetailsResponse {
  [appId: string]: { success: boolean; data?: SteamAppDetailsData };
}

interface SteamReviewsResponse {
  success: 1 | 2;
  query_summary: {
    total_positive: number;
    total_reviews: number;
    review_score: number; // 1–9
    review_score_desc: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const STEAM_STORE_BASE = 'https://store.steampowered.com';
/** Default Web API base; replaced by proxyUrl when configured */
const STEAM_WEB_API_BASE = 'https://api.steampowered.com';

/** Cache TTL: 24 hours for metadata, 1 hour for owned-games list */
const METADATA_TTL = DEFAULT_CACHE_TTL_MS;
const OWNED_GAMES_TTL = 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class SteamApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CacheService);
  private readonly rateLimiter = inject(RateLimiterService);

  /**
   * Fetch the list of owned games for a Steam user.
   *
   * Requires a proxy URL because the Steam Web API does not set CORS headers.
   * If no proxyUrl is configured the request will fail from a browser context.
   */
  getOwnedGames(
    config: SteamConnectionConfig,
    storeId: string,
  ): Observable<Game[]> {
    const cacheKey = `steam_owned_${config.steamId}`;
    const cached = this.cache.get<Game[]>(cacheKey);
    if (cached) return of(cached);

    const base = config.proxyUrl ?? STEAM_WEB_API_BASE;
    const url = `${base}/IPlayerService/GetOwnedGames/v1/`;
    const params = new HttpParams()
      .set('key', config.apiKey)
      .set('steamid', config.steamId)
      .set('include_appinfo', 'true')
      .set('include_played_free_games', 'true')
      .set('format', 'json');

    return this.rateLimiter.enqueue(() =>
      this.http.get<SteamOwnedGamesResponse>(url, { params }).pipe(
        map(res => {
          const rawGames = res.response.games ?? [];
          const games: Game[] = rawGames.map(g => ({
            id: `${storeId}_${g.appid}`,
            appId: String(g.appid),
            storeId,
            name: g.name ?? `App ${g.appid}`,
            hoursPlayed: Math.round((g.playtime_forever / 60) * 10) / 10,
          }));
          this.cache.set(cacheKey, games, OWNED_GAMES_TTL);
          return games;
        }),
      ),
    );
  }

  /**
   * Fetch rich metadata for a single Steam app from the Store API.
   * The Store API supports CORS so no proxy is needed for this endpoint.
   */
  getAppMetadata(appId: string): Observable<GameMetadata> {
    const cacheKey = `steam_meta_${appId}`;
    const cached = this.cache.get<GameMetadata>(cacheKey);
    if (cached) return of(cached);

    const detailsUrl = `${STEAM_STORE_BASE}/api/appdetails`;
    const reviewsUrl = `${STEAM_STORE_BASE}/appreviews/${appId}`;

    return this.rateLimiter.enqueue(() =>
      this.http
        .get<SteamAppDetailsResponse>(detailsUrl, {
          params: new HttpParams()
            .set('appids', appId)
            .set('filters', 'basic,genres,release_date,metacritic'),
        })
        .pipe(
          switchMap(res => {
            const entry = res[appId];
            const details = entry?.success ? entry.data : undefined;

            // Extract year from date string like "10 Oct, 2007" or "2007-10-10"
            const yearPublished = details?.release_date?.date
              ? this.parseYear(details.release_date.date)
              : undefined;

            const tags = [
              ...(details?.genres?.map(g => g.description) ?? []),
              ...(details?.categories?.map(c => c.description) ?? []),
            ];

            // Fetch review score in a separate (rate-limited) call
            return this.rateLimiter.enqueue(() =>
              this.http
                .get<SteamReviewsResponse>(reviewsUrl, {
                  params: new HttpParams()
                    .set('json', '1')
                    .set('num_per_page', '0')
                    .set('language', 'all'),
                })
                .pipe(
                  map(reviews => {
                    const qs = reviews.query_summary;
                    const communityScore =
                      qs.total_reviews > 0
                        ? Math.round(
                            (qs.total_positive / qs.total_reviews) * 100,
                          )
                        : undefined;

                    const metadata: GameMetadata = {
                      imageUrl: details?.header_image,
                      yearPublished,
                      tags: tags.length ? tags : undefined,
                      communityScore,
                      fetchedAt: Date.now(),
                    };
                    this.cache.set(cacheKey, metadata, METADATA_TTL);
                    return metadata;
                  }),
                ),
            );
          }),
        ),
    );
  }

  private parseYear(dateStr: string): number | undefined {
    // Handles "10 Oct, 2007", "Oct 10, 2007", "2007-10-10", "2007" etc.
    const match = dateStr.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : undefined;
  }
}
