import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, EMPTY, forkJoin, of, switchMap, finalize, from, mergeMap } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Game, SteamCandidate } from '../models/game.model';
import {
  BlobConnectionConfig,
  GogConnectionConfig,
  SteamConnectionConfig,
  StoreConnection,
} from '../models/store-connection.model';
import { StoreConnectionService } from './store-connection.service';
import { SteamApiService } from './steam-api.service';
import { GogApiService } from './gog-api.service';
import { BlobApiService } from './blob-api.service';
import { LoggingService } from './logging.service';

const TAG = 'Gamesync';

/** Maximum number of concurrent background metadata/search operations. */
const METADATA_CONCURRENCY = 10;

@Injectable({ providedIn: 'root' })
export class GameLibraryService {
  private readonly connectionSvc = inject(StoreConnectionService);
  private readonly steamApi = inject(SteamApiService);
  private readonly gogApi = inject(GogApiService);
  private readonly blobApi = inject(BlobApiService);
  private readonly logger = inject(LoggingService);

  private readonly _games = signal<Game[]>([]);
  private readonly _syncing = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _fetchingMetadataIds = signal<ReadonlySet<string>>(new Set());

  readonly games = this._games.asReadonly();
  readonly syncing = this._syncing.asReadonly();
  readonly error = this._error.asReadonly();
  /** IDs of games whose metadata is currently being fetched in the background. */
  readonly fetchingMetadataIds = this._fetchingMetadataIds.asReadonly();

  readonly gameCount = computed(() => this._games().length);

  /**
   * Number of non-Steam games that were searched but had no Steam match.
   * Recalculated whenever the game list changes.
   */
  readonly unmatchedCount = computed(() =>
    this._games().filter(g => {
      const conn = this.connectionSvc.getById(g.storeId);
      if (conn?.type === 'steam') return false;
      const cached = this.steamApi.getCachedCandidates(g.id);
      return cached !== null && cached.length === 0;
    }).length,
  );

  /** Aggregate all games from every configured store connection.
   *
   * Each connection is fetched independently — a failure on one does not
   * prevent the others from completing.  Games from successful connections
   * are merged into the existing library (update in-place or append); games
   * that belong to a connection that errored are left untouched.
   */
  syncAll(): Observable<Game[]> {
    const connections = this.connectionSvc.connections();
    if (connections.length === 0) {
      this.logger.info(TAG, 'syncAll: no connections configured');
      this._games.set([]);
      return of([]);
    }

    const names = connections.map(c => `${c.type.toUpperCase()} "${c.label}"`).join(', ');
    this.logger.info(TAG, `syncAll started — ${connections.length} connection(s): ${names}`);

    this._syncing.set(true);
    this._error.set(null);

    // Wrap each fetch so a single connection failure yields null instead of
    // propagating and aborting the entire forkJoin.
    const fetches = connections.map(c =>
      this.fetchForConnection(c).pipe(
        catchError(err => {
          this.logger.error(
            TAG,
            `"${c.label}" (${c.type}) sync failed — skipping: ${err?.message ?? err}`,
            err,
          );
          return of(null as Game[] | null);
        }),
      ),
    );

    return forkJoin(fetches).pipe(
      tap({
        next: results => {
          const successfulIds = new Set(
            connections
              .filter((_, i) => results[i] !== null)
              .map(c => c.id),
          );
          const freshGames = (results.filter(r => r !== null) as Game[][]).flat();

          this.logger.info(
            TAG,
            `syncAll complete — ${freshGames.length} game(s) from ${successfulIds.size}/${connections.length} connection(s)`,
          );

          // Merge: keep games from failed connections, update/add from successful ones.
          // CSV blob games are further de-duplicated against real-connection games.
          this._games.update(existing => {
            const preserved = existing.filter(g => !successfulIds.has(g.storeId));
            const merged = this.mergeBlobGames([...preserved, ...freshGames]);
            return merged;
          });

          const failedCount = connections.length - successfulIds.size;
          this._error.set(failedCount > 0
            ? `${failedCount} connection${failedCount > 1 ? 's' : ''} failed to sync`
            : null);

          this._syncing.set(false);
          this.backgroundFetchMetadata(freshGames);
        },
        error: err => {
          // Should not reach here since each fetch catches its own errors.
          const msg = err?.message ?? 'Sync failed';
          this.logger.error(TAG, `syncAll unexpected error: ${msg}`, err);
          this._error.set(msg);
          this._syncing.set(false);
        },
      }),
      switchMap(results => {
        const allFresh = (results.filter(r => r !== null) as Game[][]).flat();
        return of(allFresh);
      }),
    );
  }

  /** Remove all games that belong to a specific store connection. */
  removeByConnection(connectionId: string): void {
    this._games.update(games => games.filter(g => g.storeId !== connectionId));
  }

  /**
   * Clear the "no match" cache for a single game and immediately re-run the
   * Steam Store search for it.
   */
  retrySearch(game: Game): void {
    this.steamApi.clearCandidates(game.id);
    this.backgroundMatchNonSteamGames([game]);
  }

  /**
   * Clear the "no match" cache for every permanently unmatched non-Steam game
   * and re-run their Steam Store searches concurrently.
   */
  retryAllUnmatched(): void {
    const unmatched = this._games().filter(g => {
      const conn = this.connectionSvc.getById(g.storeId);
      if (conn?.type === 'steam') return false;
      const cached = this.steamApi.getCachedCandidates(g.id);
      return cached !== null && cached.length === 0;
    });
    if (unmatched.length === 0) return;
    this.logger.info(TAG, `retryAllUnmatched: clearing cache for ${unmatched.length} game(s)`);
    unmatched.forEach(g => this.steamApi.clearCandidates(g.id));
    this.backgroundMatchNonSteamGames(unmatched);
  }

  getById(id: string): Game | undefined {
    return this._games().find(g => g.id === id);
  }

  updateGameMetadata(gameId: string, metadata: Game['metadata']): void {
    this._games.update(games =>
      games.map(g => (g.id === gameId ? { ...g, metadata } : g)),
    );
  }

  updateGameCandidates(gameId: string, candidates: SteamCandidate[]): void {
    this._games.update(games =>
      games.map(g => (g.id === gameId ? { ...g, steamCandidates: candidates } : g)),
    );
  }

  clearGameCandidates(gameId: string): void {
    this._games.update(games =>
      games.map(g => (g.id === gameId ? { ...g, steamCandidates: undefined } : g)),
    );
  }

  /**
   * Entry point called after syncAll. Handles both Steam and non-Steam games.
   * - Steam: applies cached metadata then queues background fetches.
   * - Non-Steam: searches Steam Store by title, auto-matches exact hits,
   *   and presents close candidates to the user in the game detail view.
   */
  private backgroundFetchMetadata(games: Game[]): void {
    this.backgroundFetchSteamMetadata(games);
    this.backgroundMatchNonSteamGames(games);
  }

  /**
   * For Steam games:
   * 1. Batch-apply any already-cached metadata in a single signal update.
   * 2. Queue concurrent background fetches for uncached games.
   */
  private backgroundFetchSteamMetadata(games: Game[]): void {
    const steamGames = games.filter(g => {
      const conn = this.connectionSvc.getById(g.storeId);
      return conn?.type === 'steam';
    });
    if (steamGames.length === 0) return;

    // ── Pass 1: apply all cached metadata in one signal write ─────────────
    const cacheHits = new Map(
      steamGames
        .map(g => [g.id, this.steamApi.getCachedMetadata(g.appId)] as const)
        .filter((entry): entry is [string, NonNullable<ReturnType<typeof this.steamApi.getCachedMetadata>>] => entry[1] !== null),
    );

    if (cacheHits.size > 0) {
      this.logger.info(TAG, `metadata cache: applying ${cacheHits.size} cached entries`);
      this._games.update(gs =>
        gs.map(g => (cacheHits.has(g.id) ? { ...g, metadata: cacheHits.get(g.id) } : g)),
      );
    }

    // ── Pass 2: background-fetch for games not in cache ───────────────────
    const uncached = steamGames.filter(g => !cacheHits.has(g.id));
    if (uncached.length === 0) return;

    this.logger.info(
      TAG,
      `metadata background fetch: ${uncached.length} game(s), concurrency=${METADATA_CONCURRENCY}`,
    );
    this._fetchingMetadataIds.update(ids => new Set([...ids, ...uncached.map(g => g.id)]));

    from(uncached)
      .pipe(
        mergeMap(
          game =>
            this.steamApi.getAppMetadata(game.appId).pipe(
              tap(metadata => {
                this.logger.info(
                  TAG,
                  `metadata applied: id=${game.id} appId=${game.appId} score=${metadata.communityScore ?? 'n/a'} image=${metadata.imageUrl ? 'yes' : 'no'}`,
                );
                this.updateGameMetadata(game.id, metadata);
              }),
              catchError(err => {
                this.logger.warn(
                  TAG,
                  `background metadata fetch failed for appId=${game.appId}: ${err?.message ?? err}`,
                );
                return EMPTY;
              }),
              finalize(() => {
                this._fetchingMetadataIds.update(ids => {
                  const next = new Set(ids);
                  next.delete(game.id);
                  return next;
                });
              }),
            ),
          METADATA_CONCURRENCY,
        ),
      )
      .subscribe();
  }

  /**
   * For non-Steam games (e.g. Epic):
   * - Games with a cached confirmed match → apply cached metadata or re-fetch.
   * - Games with cached search candidates → restore candidates onto the game signal.
   * - Games with no cache entry → search Steam Store, auto-match exact hits,
   *   or store the candidate list for the user to pick from.
   */
  private backgroundMatchNonSteamGames(games: Game[]): void {
    const nonSteamGames = games.filter(g => {
      const conn = this.connectionSvc.getById(g.storeId);
      return conn?.type !== 'steam';
    });
    if (nonSteamGames.length === 0) return;

    // Only games that still need enrichment (no community score yet)
    const needsEnrichment = nonSteamGames.filter(
      g => g.metadata?.communityScore === undefined,
    );
    if (needsEnrichment.length === 0) return;

    this.logger.info(TAG, `non-Steam enrichment: ${needsEnrichment.length} game(s)`);

    const toFetch: Array<{ game: Game; steamAppId: string }> = [];
    const toSearch: Game[] = [];

    for (const game of needsEnrichment) {
      const steamAppId = this.steamApi.getConfirmedMatch(game.id);
      if (steamAppId) {
        // Confirmed match — apply from cache or re-fetch
        const cached = this.steamApi.getCachedMetadata(steamAppId);
        if (cached) {
          this.updateGameMetadata(game.id, cached);
        } else {
          toFetch.push({ game, steamAppId });
        }
        continue;
      }

      const cachedCandidates = this.steamApi.getCachedCandidates(game.id);
      if (cachedCandidates !== null) {
        // Previously searched — restore candidates (even if empty = "no match")
        if (cachedCandidates.length > 0) {
          this.updateGameCandidates(game.id, cachedCandidates);
        }
        continue;
      }

      toSearch.push(game);
    }

    // Fetch metadata for games with a confirmed match but missing metadata
    if (toFetch.length > 0) {
      this.logger.info(TAG, `non-Steam: fetching metadata for ${toFetch.length} confirmed match(es)`);
      this._fetchingMetadataIds.update(ids => new Set([...ids, ...toFetch.map(e => e.game.id)]));

      from(toFetch)
        .pipe(
          mergeMap(
            ({ game, steamAppId }) =>
              this.steamApi.getAppMetadata(steamAppId).pipe(
                tap(metadata => {
                  this.logger.info(TAG, `non-Steam metadata applied: id=${game.id} via steamAppId=${steamAppId}`);
                  this.updateGameMetadata(game.id, metadata);
                }),
                catchError(err => {
                  this.logger.warn(TAG, `non-Steam metadata fetch failed for id=${game.id}: ${err?.message ?? err}`);
                  return EMPTY;
                }),
                finalize(() => {
                  this._fetchingMetadataIds.update(ids => {
                    const next = new Set(ids);
                    next.delete(game.id);
                    return next;
                  });
                }),
              ),
            METADATA_CONCURRENCY,
          ),
        )
        .subscribe();
    }

    // Search Steam Store for unmatched games
    if (toSearch.length > 0) {
      this.logger.info(TAG, `non-Steam: searching Steam Store for ${toSearch.length} game(s)`);
      this._fetchingMetadataIds.update(ids => new Set([...ids, ...toSearch.map(g => g.id)]));

      from(toSearch)
        .pipe(
          mergeMap(
            game =>
              this.steamApi.searchStore(game.name).pipe(
                switchMap(candidates => {
                  const exact = candidates.find(c => this.titlesMatch(c.name, game.name));
                  if (exact) {
                    this.steamApi.setConfirmedMatch(game.id, exact.appId);
                    this.logger.info(TAG, `auto-match: "${game.name}" → "${exact.name}" (${exact.appId})`);
                    return this.steamApi.getAppMetadata(exact.appId).pipe(
                      tap(metadata => {
                        this.logger.info(TAG, `non-Steam auto-match metadata applied: id=${game.id}`);
                        this.updateGameMetadata(game.id, metadata);
                      }),
                      catchError(err => {
                        this.logger.warn(TAG, `metadata fetch after auto-match failed for id=${game.id}: ${err?.message ?? err}`);
                        return EMPTY;
                      }),
                    );
                  }
                  if (candidates.length > 0) {
                    this.logger.info(TAG, `candidates for "${game.name}": ${candidates.length} option(s)`);
                    this.steamApi.setCachedCandidates(game.id, candidates);
                    this.updateGameCandidates(game.id, candidates);
                  } else {
                    this.logger.info(TAG, `no Steam match found for "${game.name}"`);
                    this.steamApi.setCachedCandidates(game.id, []);
                  }
                  return EMPTY;
                }),
                catchError(err => {
                  this.logger.warn(TAG, `Steam search failed for "${game.name}": ${err?.message ?? err}`);
                  this.steamApi.setCachedCandidates(game.id, []);
                  return EMPTY;
                }),
                finalize(() => {
                  this._fetchingMetadataIds.update(ids => {
                    const next = new Set(ids);
                    next.delete(game.id);
                    return next;
                  });
                }),
              ),
            METADATA_CONCURRENCY,
          ),
        )
        .subscribe();
    }
  }

  /**
   * De-duplicate CSV blob games against real-connection games.
   *
   * For each blob game:
   *  - If a non-blob game with the same normalised title exists, take
   *    `hoursPlayed = max(existing, csv)` and discard the blob entry.
   *  - Otherwise keep the blob entry as a standalone game (e.g. Epic, Battle.net).
   */
  private mergeBlobGames(games: Game[]): Game[] {
    const blobGames = games.filter(g => {
      const conn = this.connectionSvc.getById(g.storeId);
      return conn?.type === 'blob';
    });
    if (blobGames.length === 0) return games;

    const realGames = games.filter(g => {
      const conn = this.connectionSvc.getById(g.storeId);
      return conn?.type !== 'blob';
    });

    // Build a normalised-name index over real games for O(1) lookup.
    const byNormName = new Map<string, number>(); // normName → index in realGames array
    const mutableReal = realGames.map(g => ({ ...g }));
    mutableReal.forEach((g, i) => byNormName.set(this.normTitle(g.name), i));

    const unmatched: Game[] = [];
    for (const blobGame of blobGames) {
      const key = this.normTitle(blobGame.name);
      const idx = byNormName.get(key);
      if (idx !== undefined) {
        // Update playtime if CSV reports more.
        if (blobGame.hoursPlayed > mutableReal[idx].hoursPlayed) {
          mutableReal[idx] = { ...mutableReal[idx], hoursPlayed: blobGame.hoursPlayed };
          this.logger.info(
            TAG,
            `blob merge: updated hoursPlayed for "${blobGame.name}" to ${blobGame.hoursPlayed}h`,
          );
        }
      } else {
        unmatched.push(blobGame);
      }
    }

    if (unmatched.length > 0) {
      this.logger.info(TAG, `blob merge: ${unmatched.length} unmatched game(s) added from CSV`);
    }
    return [...mutableReal, ...unmatched];
  }

  /** Normalise a title for fuzzy matching (lowercase, strip symbols & punctuation). */
  private normTitle(name: string): string {
    return name
      .toLowerCase()
      .replace(/[™®©:,.\-''""!?]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Case-insensitive title comparison, ignoring trademark symbols and extra whitespace. */
  private titlesMatch(a: string, b: string): boolean {
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
    return normalize(a) === normalize(b);
  }

  private fetchForConnection(conn: StoreConnection): Observable<Game[]> {
    this.logger.info(TAG, `fetching "${conn.label}" (${conn.type})`);
    let fetch$: Observable<Game[]>;

    switch (conn.type) {
      case 'steam':
        fetch$ = this.steamApi.getOwnedGames(
          conn.config as SteamConnectionConfig,
          conn.id,
        );
        break;
      case 'gog':
        fetch$ = this.gogApi.getOwnedGames(
          conn.config as GogConnectionConfig,
          conn.id,
          conn.id,
        );
        break;
      case 'blob':
        fetch$ = this.blobApi.getOwnedGames(
          conn.config as BlobConnectionConfig,
          conn.id,
        );
        break;
      default:
        return of([]);
    }

    return fetch$.pipe(
      tap(games =>
        this.logger.info(TAG, `"${conn.label}" → ${games.length} game(s)`),
      ),
    );
  }
}
