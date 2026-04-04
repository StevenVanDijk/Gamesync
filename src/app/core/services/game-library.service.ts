import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class GameLibraryService {
  private readonly connectionSvc = inject(StoreConnectionService);
  private readonly steamApi = inject(SteamApiService);
  private readonly epicApi = inject(EpicApiService);
  private readonly logger = inject(LoggingService);

  private readonly _games = signal<Game[]>([]);
  private readonly _syncing = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly games = this._games.asReadonly();
  readonly syncing = this._syncing.asReadonly();
  readonly error = this._error.asReadonly();

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
