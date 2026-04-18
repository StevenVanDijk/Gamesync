import { inject, Injectable, InjectionToken } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Game } from '../models/game.model';
import { BlobConnectionConfig } from '../models/store-connection.model';
import { LoggingService } from './logging.service';

export const BLOB_BACKEND_URL = new InjectionToken<string>('BLOB_BACKEND_URL', {
  providedIn: 'root',
  factory: () => '/api/blob',
});

interface CsvGame {
  name: string;
  source: string;
  hoursPlayed: number;
}

const TAG = 'Blob';

@Injectable({ providedIn: 'root' })
export class BlobApiService {
  private readonly http = inject(HttpClient);
  private readonly backendUrl = inject(BLOB_BACKEND_URL);
  private readonly logger = inject(LoggingService);

  getOwnedGames(config: BlobConnectionConfig, connectionId: string): Observable<Game[]> {
    this.logger.info(TAG, `GET library (url length=${config.url.length})`);
    return this.http
      .get<{ games: CsvGame[] }>(`${this.backendUrl}/library`, {
        params: new HttpParams().set('url', encodeURIComponent(config.url)),
      })
      .pipe(
        map(res => {
          this.logger.info(TAG, `library: ${res.games.length} game(s) received`);
          return res.games.map(g => ({
            id: `${connectionId}_${slugify(g.name)}`,
            appId: slugify(g.name),
            storeId: connectionId,
            name: g.name,
            hoursPlayed: g.hoursPlayed,
            csvSource: g.source || undefined,
          }));
        }),
        catchError(err => {
          this.logger.error(
            TAG,
            `library failed — HTTP ${err?.status ?? '?'}: ${err?.message ?? err}`,
            err,
          );
          throw err;
        }),
      );
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}
