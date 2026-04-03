import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Game } from '../models/game.model';
import {
  EpicConnectionConfig,
  SteamConnectionConfig,
  StoreConnection,
} from '../models/store-connection.model';
import { StoreConnectionService } from './store-connection.service';
import { SteamApiService } from './steam-api.service';

interface EpicGameImport {
  appId: string;
  name: string;
  hoursPlayed: number;
}

@Injectable({ providedIn: 'root' })
export class GameLibraryService {
  private readonly connectionSvc = inject(StoreConnectionService);
  private readonly steamApi = inject(SteamApiService);

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
      this._games.set([]);
      return of([]);
    }

    this._syncing.set(true);
    this._error.set(null);

    const fetches = connections.map(c => this.fetchForConnection(c));

    return forkJoin(fetches).pipe(
      tap({
        next: results => {
          const allGames = results.flat();
          this._games.set(allGames);
          this._syncing.set(false);
        },
        error: err => {
          this._error.set(err?.message ?? 'Sync failed');
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
    switch (conn.type) {
      case 'steam':
        return this.steamApi.getOwnedGames(
          conn.config as SteamConnectionConfig,
          conn.id,
        );
      case 'epic':
        return of(this.parseEpicGames(conn));
      default:
        return of([]);
    }
  }

  private parseEpicGames(conn: StoreConnection): Game[] {
    const cfg = conn.config as EpicConnectionConfig;
    if (!cfg.gamesJson) return [];
    try {
      const imports: EpicGameImport[] = JSON.parse(cfg.gamesJson);
      return imports.map(g => ({
        id: `${conn.id}_${g.appId}`,
        appId: g.appId,
        storeId: conn.id,
        name: g.name,
        hoursPlayed: g.hoursPlayed,
      }));
    } catch {
      return [];
    }
  }
}
