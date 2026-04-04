import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { GameLibraryService } from './game-library.service';
import { StoreConnectionService } from './store-connection.service';
import { RateLimiterService } from './rate-limiter.service';
import { CacheService } from './cache.service';
import { SteamConnectionConfig } from '../models/store-connection.model';

function makeImmediateRateLimiter(): Partial<RateLimiterService> {
  return {
    delayMs: 0,
    queueLength: 0,
    enqueue: <T>(fn: () => Observable<T>) => fn(),
  };
}

describe('GameLibraryService (US-001, US-004, US-008)', () => {
  let librarySvc: GameLibraryService;
  let connectionSvc: StoreConnectionService;
  let httpMock: HttpTestingController;

  const steamConfig: SteamConnectionConfig = {
    apiKey: 'KEY',
    steamId: '76561198000000001',
  };

  const ownedGamesFlush = {
    response: {
      games: [{ appid: 440, name: 'TF2', playtime_forever: 120 }],
    },
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RateLimiterService, useValue: makeImmediateRateLimiter() },
      ],
    });
    librarySvc = TestBed.inject(GameLibraryService);
    connectionSvc = TestBed.inject(StoreConnectionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should start with an empty game list (US-001)', () => {
    expect(librarySvc.games()).toEqual([]);
    expect(librarySvc.gameCount()).toBe(0);
  });

  it('should sync Steam games and expose them in the library (US-001, US-004)', async () => {
    connectionSvc.add('steam', 'My Steam', steamConfig);
    const resultPromise = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).flush(ownedGamesFlush);

    await resultPromise;
    expect(librarySvc.gameCount()).toBe(1);
    expect(librarySvc.games()[0].name).toBe('TF2');
    expect(librarySvc.games()[0].hoursPlayed).toBe(2);
  });

  it('should parse Epic games from imported JSON (US-003)', async () => {
    const epicJson = '[{"appId":"fn","name":"Fortnite","hoursPlayed":5}]';
    connectionSvc.add('epic', 'My Epic', { gamesJson: epicJson });

    await firstValueFrom(librarySvc.syncAll());
    httpMock.expectNone(() => true);

    expect(librarySvc.gameCount()).toBe(1);
    expect(librarySvc.games()[0].name).toBe('Fortnite');
    expect(librarySvc.games()[0].hoursPlayed).toBe(5);
  });

  it('should aggregate games from multiple connections (US-001)', async () => {
    connectionSvc.add('steam', 'Steam', steamConfig);
    connectionSvc.add('epic', 'Epic', { gamesJson: '[{"appId":"fn","name":"Fortnite","hoursPlayed":5}]' });

    const resultPromise = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).flush(ownedGamesFlush);
    await resultPromise;

    expect(librarySvc.gameCount()).toBe(2);
  });

  it('should remove games for a deleted connection (US-008)', async () => {
    const conn = connectionSvc.add('steam', 'Steam', steamConfig);
    const p = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).flush(ownedGamesFlush);
    await p;
    expect(librarySvc.gameCount()).toBe(1);

    librarySvc.removeByConnection(conn.id);
    expect(librarySvc.gameCount()).toBe(0);
  });

  it('should update metadata for a game (US-005)', async () => {
    connectionSvc.add('steam', 'Steam', steamConfig);
    const p = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).flush(ownedGamesFlush);
    await p;

    const game = librarySvc.games()[0];
    librarySvc.updateGameMetadata(game.id, {
      communityScore: 95,
      imageUrl: 'img.jpg',
      yearPublished: 2007,
      tags: ['Action'],
    });

    const updated = librarySvc.getById(game.id);
    expect(updated?.metadata?.communityScore).toBe(95);
    expect(updated?.metadata?.imageUrl).toBe('img.jpg');
  });

  it('should return undefined for an unknown game id', () => {
    expect(librarySvc.getById('nonexistent')).toBeUndefined();
  });

  it('should emit empty array when no connections exist (US-001)', async () => {
    const result = await firstValueFrom(librarySvc.syncAll());
    httpMock.expectNone(() => true);
    expect(result).toEqual([]);
  });
});
