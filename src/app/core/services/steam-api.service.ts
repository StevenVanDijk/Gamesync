import { inject, Injectable, InjectionToken } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, map, switchMap, catchError, retry, timer, OperatorFunction } from 'rxjs';
import { CacheService, PERMANENT_CACHE } from './cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { LoggingService } from './logging.service';
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

/**
 * URL of the backend proxy that forwards requests to the Steam API.
 * Default: '/api/steam' (relative, works on Vercel and any same-origin host).
 * Override to 'http://localhost:3000/api/steam' in local dev environments.
 */
export const STEAM_BACKEND_URL = new InjectionToken<string>('STEAM_BACKEND_URL', {
  providedIn: 'root',
  factory: () => '/api/steam',
});

/** Metadata is cached permanently — game cover/tags/scores rarely change. */
const METADATA_TTL = PERMANENT_CACHE;
/** Owned-games list is refreshed every hour to pick up new purchases. */
const OWNED_GAMES_TTL = 60 * 60 * 1000;

const TAG = 'Steam';

@Injectable({ providedIn: 'root' })
export class SteamApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CacheService);
  private readonly rateLimiter = inject(RateLimiterService);
  private readonly backendUrl = inject(STEAM_BACKEND_URL);
  private readonly logger = inject(LoggingService);

  /**
   * Fetch the list of owned games for a Steam user via the backend proxy.
   */
  getOwnedGames(
    config: SteamConnectionConfig,
    storeId: string,
  ): Observable<Game[]> {
    const cacheKey = `steam_owned_${config.steamId}`;
    const cached = this.cache.get<Game[]>(cacheKey);
    if (cached) {
      this.logger.info(TAG, `owned-games cache hit (steamId=${config.steamId})`);
      return of(cached);
    }

    const url = `${this.backendUrl}/owned-games`;
    this.logger.info(TAG, `GET ${url} (steamId=${config.steamId})`);

    const params = new HttpParams()
      .set('key', config.apiKey)
      .set('steamid', config.steamId);

    return this.rateLimiter.enqueue(() =>
      this.http.get<SteamOwnedGamesResponse>(url, { params }).pipe(
        map(res => {
          const rawGames = res.response.games ?? [];
          this.logger.info(TAG, `owned-games: ${rawGames.length} game(s) received`);
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
        catchError(err => {
          const detail = err?.error?.detail ?? err?.error?.error ?? '';
          this.logger.error(
            TAG,
            `owned-games failed — HTTP ${err?.status ?? '?'}${detail ? ': ' + detail : ''}`,
            err,
          );
          throw err;
        }),
      ),
    );
  }

  /**
   * Return cached metadata for a Steam app synchronously, or null if not cached.
   * Does not trigger a network request.
   */
  getCachedMetadata(appId: string): GameMetadata | null {
    return this.cache.get<GameMetadata>(`steam_meta_${appId}`);
  }

  /**
   * Fetch rich metadata for a single Steam app via the backend proxy.
   */
  getAppMetadata(appId: string): Observable<GameMetadata> {
    const cacheKey = `steam_meta_${appId}`;
    const cached = this.cache.get<GameMetadata>(cacheKey);
    if (cached) {
      this.logger.info(TAG, `metadata cache hit (appId=${appId})`);
      return of(cached);
    }

    const detailsUrl = `${this.backendUrl}/app-details`;
    const reviewsUrl = `${this.backendUrl}/reviews/${appId}`;
    this.logger.info(TAG, `fetching metadata for appId=${appId}`);

    return this.rateLimiter.enqueue(() =>
      this.http
        .get<SteamAppDetailsResponse>(detailsUrl, {
          params: new HttpParams().set('appids', appId),
        })
        .pipe(
          this.retryOn429('app-details'),
          switchMap(res => {
            const entry = res[appId];
            const details = entry?.success ? entry.data : undefined;
            if (!details) {
              this.logger.warn(
                TAG,
                `app-details: no data returned for appId=${appId} (success=${entry?.success})`,
              );
            }

            const yearPublished = details?.release_date?.date
              ? this.parseYear(details.release_date.date)
              : undefined;

            const tags = [
              ...(details?.genres?.map(g => g.description) ?? []),
              ...(details?.categories?.map(c => c.description) ?? []),
            ];

            return this.rateLimiter.enqueue(() =>
              this.http
                .get<SteamReviewsResponse>(reviewsUrl, {
                  params: new HttpParams()
                    .set('json', '1')
                    .set('num_per_page', '0')
                    .set('language', 'all'),
                })
                .pipe(
                  this.retryOn429('reviews'),
                  map(reviews => {
                    const qs = reviews?.query_summary;
                    const communityScore =
                      qs && qs.total_reviews > 0
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
                  catchError(err => {
                    const detail = err?.error?.detail ?? err?.error?.error ?? '';
                    this.logger.error(
                      TAG,
                      `reviews failed for appId=${appId} — HTTP ${err?.status ?? '?'}${detail ? ': ' + detail : ''}`,
                      err,
                    );
                    throw err;
                  }),
                ),
            );
          }),
          catchError(err => {
            const detail = err?.error?.detail ?? err?.error?.error ?? '';
            this.logger.error(
              TAG,
              `app-details failed for appId=${appId} — HTTP ${err?.status ?? '?'}${detail ? ': ' + detail : ''}`,
              err,
            );
            throw err;
          }),
        ),
    );
  }

  /**
   * Retry operator that backs off on HTTP 429 (Too Many Requests) and
   * re-throws immediately for any other status code.
   * Delays: 2 s → 4 s → 8 s (up to 3 retries).
   */
  private retryOn429<T>(label: string): OperatorFunction<T, T> {
    return retry({
      count: 3,
      delay: (err, attempt) => {
        if (err?.status !== 429) throw err;
        const waitMs = (2 ** attempt) * 1_000;
        this.logger.warn(TAG, `429 from ${label} — retry ${attempt}/3 in ${waitMs / 1000}s`);
        return timer(waitMs);
      },
    });
  }

  private parseYear(dateStr: string): number | undefined {
    // Handles "10 Oct, 2007", "Oct 10, 2007", "2007-10-10", "2007" etc.
    const match = dateStr.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : undefined;
  }
}
