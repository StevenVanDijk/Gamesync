import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, EMPTY, forkJoin, of, switchMap, finalize, from, mergeMap } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Game } from '../models/game.model';
import {
  EpicConnectionConfig,
  SteamConnectionConfig,
  StoreConnection,
} from '../models/store-connection.model';
import { StoreConnectionService } from './store-connection.service';
import { SteamApiService } from './steam-api.service';
import { EpicApiService } from './epic-api.service';
import { LoggingService } from './logging.service';

const TAG = 'Gamesync';

/** Maximum number of concurrent background metadata fetches. */
const METADATA_CONCURRENCY = 10;

@Injectable({ providedIn: 'root' })
export class GameLibraryService {
  private readonly connectionSvc = inject(StoreConnectionService);
  private readonly steamApi = inject(SteamApiService);
  private readonly epicApi = inject(EpicApiService);
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

  /** Aggregate all games from every configured store connection. */
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

    const fetches = connections.map(c => this.fetchForConnection(c));

    return forkJoin(fetches).pipe(
      tap({
        next: results => {
          const allGames = results.flat();
          this.logger.info(
            TAG,
            `syncAll complete — ${allGames.length} game(s) across ${connections.length} connection(s)`,
          );
          this._games.set(allGames);
          this._syncing.set(false);
          this.backgroundFetchMetadata(allGames);
        },
        error: err => {
          const msg = err?.message ?? 'Sync failed';
          this.logger.error(TAG, `syncAll failed: ${msg}`, err);
          this._error.set(msg);
          this._syncing.set(false);
        },
      }),
      switchMap(results => of(results.flat())),
    );
  }

  /** Remove all games that belong to a specific store connection. */
  removeByConnection(connectionId: string): void {
    this._games.update(games => games.filter(g => g.storeId !== connectionId));
  }

  getById(id: string): Game | undefined {
    return this._games().find(g => g.id === id);
  }

  updateGameMetadata(gameId: string, metadata: Game['metadata']): void {
    this._games.update(games =>
      games.map(g => (g.id === gameId ? { ...g, metadata } : g)),
    );
  }

  /**
   * For every Steam game in the list:
   * 1. Batch-apply any already-cached metadata in a single signal update.
   * 2. Queue background fetches for games whose metadata is not yet cached.
   *    Failures are silently swallowed so they never affect the library view.
   */
  private backgroundFetchMetadata(games: Game[]): void {
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
    // Mark all uncached games as loading in one signal write.
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
      case 'epic':
        fetch$ = this.epicApi.getOwnedGames(
          conn.config as EpicConnectionConfig,
          conn.id,
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
      catchError(err => {
        this.logger.error(
          TAG,
          `"${conn.label}" (${conn.type}) fetch failed: ${err?.message ?? err}`,
          err,
        );
        throw err;
      }),
    );
  }
}
