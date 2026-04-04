import { inject, Injectable, InjectionToken } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Game } from '../models/game.model';
import { EpicConnectionConfig } from '../models/store-connection.model';
import { StoreConnectionService } from './store-connection.service';

/**
 * URL of the backend Epic proxy.
 * Default: '/api/epic' (relative, works on Vercel and any same-origin host).
 */
export const EPIC_BACKEND_URL = new InjectionToken<string>('EPIC_BACKEND_URL', {
  providedIn: 'root',
  factory: () => '/api/epic',
});

interface TokenResponse {
  accountId: string;
  displayName?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface LibraryGame {
  appId: string;
  name: string;
  hoursPlayed: number;
  imageUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class EpicApiService {
  private readonly http = inject(HttpClient);
  private readonly backendUrl = inject(EPIC_BACKEND_URL);
  private readonly connectionSvc = inject(StoreConnectionService);

  /** Returns the Epic authorization URL to redirect the user to. */
  getAuthUrl(): Observable<string> {
    return this.http
      .get<{ url: string }>(`${this.backendUrl}/auth-url`)
      .pipe(map(r => r.url));
  }

  /** Exchange an authorization code for tokens + account info. */
  exchangeCode(code: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.backendUrl}/token`, { code });
  }

  /**
   * Fetch owned games for a connection, refreshing the token first if expired.
   */
  getOwnedGames(config: EpicConnectionConfig, connectionId: string, storeId: string): Observable<Game[]> {
    return this.withFreshToken(config, connectionId).pipe(
      switchMap(accessToken =>
        this.http
          .get<{ games: LibraryGame[] }>(`${this.backendUrl}/library/${config.accountId}`, {
            params: { accessToken },
          })
          .pipe(
            map(res =>
              res.games.map((g, i) => ({
                id: `${storeId}_${g.appId}_${i}`,
                appId: g.appId,
                storeId,
                name: g.name,
                hoursPlayed: g.hoursPlayed,
                metadata: g.imageUrl
                  ? { imageUrl: g.imageUrl, fetchedAt: Date.now() }
                  : undefined,
              })),
            ),
          ),
      ),
    );
  }

  /**
   * Returns a valid (possibly refreshed) access token.
   * If the token is expired, refreshes it and persists the new tokens.
   */
  private withFreshToken(config: EpicConnectionConfig, connectionId: string): Observable<string> {
    const BUFFER_MS = 60_000; // refresh 1 min before expiry
    if (Date.now() + BUFFER_MS < config.expiresAt) {
      return of(config.accessToken);
    }

    return this.http
      .post<RefreshResponse>(`${this.backendUrl}/refresh`, { refreshToken: config.refreshToken })
      .pipe(
        map(r => {
          // Persist the updated tokens
          this.connectionSvc.update(connectionId, {
            config: {
              ...config,
              accessToken: r.accessToken,
              refreshToken: r.refreshToken,
              expiresAt: r.expiresAt,
            },
          });
          return r.accessToken;
        }),
      );
  }
}
