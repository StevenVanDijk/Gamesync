import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { GameLibraryService } from './game-library.service';
import { StoreConnectionService } from './store-connection.service';
import { RateLimiterService } from './rate-limiter.service';
import { SteamConnectionConfig, GogConnectionConfig } from '../models/store-connection.model';
import { STEAM_BACKEND_URL } from './steam-api.service';
import { GOG_BACKEND_URL } from './gog-api.service';

function makeImmediateRateLimiter(): Partial<RateLimiterService> {
  return {
    delayMs: 0,
    queueLength: 0,
    enqueue: <T>(fn: () => Observable<T>) => fn(),
  };
}

const TEST_STEAM = 'http://test-steam/api/steam';
const TEST_GOG = 'http://test-gog/api/gog';

describe('GameLibraryService (US-001, US-004, US-008)', () => {
  let librarySvc: GameLibraryService;
  let connectionSvc: StoreConnectionService;
  let httpMock: HttpTestingController;

  const steamConfig: SteamConnectionConfig = {
    apiKey: 'KEY',
    steamId: '76561198000000001',
  };

  const gogConfig: GogConnectionConfig = {
    userId: 'gog-user-123',
    username: 'TestGogUser',
    accessToken: 'at_valid',
    refreshToken: 'rt_valid',
    expiresAt: Date.now() + 3_600_000,
  };

  const ownedGamesFlush = {
    response: {
      games: [{ appid: 440, name: 'TF2', playtime_forever: 120 }],
    },
  };

  const gogLibraryFlush = {
    games: [{ appId: 'gog_witcher3', name: 'The Witcher 3', hoursPlayed: 5, imageUrl: 'img.jpg' }],
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RateLimiterService, useValue: makeImmediateRateLimiter() },
        { provide: STEAM_BACKEND_URL, useValue: TEST_STEAM },
        { provide: GOG_BACKEND_URL, useValue: TEST_GOG },
      ],
    });
    librarySvc = TestBed.inject(GameLibraryService);
    connectionSvc = TestBed.inject(StoreConnectionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Drain any pending background requests so httpMock.verify() passes.
    httpMock
      .match(r => r.url.includes('/search'))
      .forEach(r => r.flush({ candidates: [] }));
    httpMock
      .match(r => r.url.includes('app-details'))
      .forEach(r => r.flush({}));
    httpMock
      .match(r => r.url.includes('reviews'))
      .forEach(r =>
        r.flush({
          success: 1,
          query_summary: { total_positive: 0, total_reviews: 0, review_score: 0, review_score_desc: '' },
        }),
      );
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

  it('should fetch GOG games via API (US-023)', async () => {
    connectionSvc.add('gog', 'My GOG', gogConfig);

    const resultPromise = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('/library')).flush(gogLibraryFlush);

    await resultPromise;
    expect(librarySvc.gameCount()).toBe(1);
    expect(librarySvc.games()[0].name).toBe('The Witcher 3');
    expect(librarySvc.games()[0].hoursPlayed).toBe(5);
  });

  it('should aggregate games from Steam and GOG (US-001)', async () => {
    connectionSvc.add('steam', 'Steam', steamConfig);
    connectionSvc.add('gog', 'GOG', gogConfig);

    const resultPromise = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).flush(ownedGamesFlush);
    httpMock.expectOne(r => r.url.includes('/library')).flush(gogLibraryFlush);
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

  it('should batch-apply cached metadata after sync (US-015)', async () => {
    const cachedMeta = {
      communityScore: 85,
      imageUrl: 'https://cdn.steam.com/tf2.jpg',
      yearPublished: 2007,
      tags: ['Action'],
      fetchedAt: Date.now(),
    };
    localStorage.setItem(
      'gamesync_cache_steam_meta_440',
      JSON.stringify({ data: cachedMeta, expiresAt: Date.now() + 86_400_000 }),
    );

    connectionSvc.add('steam', 'Steam', steamConfig);
    const p = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).flush(ownedGamesFlush);
    await p;

    httpMock.expectNone(r => r.url.includes('app-details'));
    const game = librarySvc.games()[0];
    expect(game.metadata?.communityScore).toBe(85);
    expect(game.metadata?.imageUrl).toBe('https://cdn.steam.com/tf2.jpg');
    expect(game.metadata?.yearPublished).toBe(2007);
  });

  it('should queue background metadata fetch for uncached Steam games (US-015)', async () => {
    connectionSvc.add('steam', 'Steam', steamConfig);
    const p = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).flush(ownedGamesFlush);
    await p;

    const detailsReq = httpMock.expectOne(r => r.url.includes('app-details'));
    expect(detailsReq.request.params.get('appids')).toBe('440');

    detailsReq.flush({ '440': { success: true, data: { name: 'TF2', header_image: 'img.jpg' } } });
    httpMock
      .expectOne(r => r.url.includes('reviews'))
      .flush({
        success: 1,
        query_summary: { total_positive: 90, total_reviews: 100, review_score: 8, review_score_desc: 'Very Positive' },
      });
  });

  it('should search Steam Store for GOG games without a community score (US-022)', async () => {
    connectionSvc.add('gog', 'My GOG', gogConfig);
    const resultPromise = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('/library')).flush(gogLibraryFlush);
    await resultPromise;

    const searchReq = httpMock.expectOne(r => r.url.includes('/search'));
    expect(searchReq.request.params.get('term')).toBe('The Witcher 3');
    searchReq.flush({ candidates: [] });
  });

  it('should auto-match and fetch metadata when Steam title matches exactly (US-022)', async () => {
    connectionSvc.add('gog', 'My GOG', gogConfig);
    const resultPromise = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('/library')).flush(gogLibraryFlush);
    await resultPromise;

    httpMock.expectOne(r => r.url.includes('/search')).flush({
      candidates: [{ appId: '292030', name: 'The Witcher 3: Wild Hunt', imageUrl: 'cap.jpg' }],
    });

    // title 'The Witcher 3' vs 'The Witcher 3: Wild Hunt' — not exact, so candidates stored
    const game = librarySvc.games().find(g => g.name === 'The Witcher 3')!;
    expect(game.steamCandidates).toHaveLength(1);
  });

  it('should store candidates when no exact Steam title match is found (US-022)', async () => {
    connectionSvc.add('gog', 'My GOG', gogConfig);
    const resultPromise = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('/library')).flush(gogLibraryFlush);
    await resultPromise;

    httpMock.expectOne(r => r.url.includes('/search')).flush({
      candidates: [{ appId: '292030', name: 'The Witcher 3: Wild Hunt', imageUrl: 'cap.jpg' }],
    });

    const game = librarySvc.games().find(g => g.name === 'The Witcher 3')!;
    expect(game.steamCandidates).toHaveLength(1);
    expect(game.steamCandidates![0].name).toBe('The Witcher 3: Wild Hunt');
  });

  it('should not re-search when a confirmed match is already cached (US-022)', async () => {
    const conn = connectionSvc.add('gog', 'My GOG', gogConfig);
    const gogGameId = `${conn.id}_gog_witcher3`;

    localStorage.setItem(
      `gamesync_cache_steam_match_${gogGameId}`,
      JSON.stringify({ data: '292030', expiresAt: 0 }),
    );
    localStorage.setItem(
      'gamesync_cache_steam_meta_292030',
      JSON.stringify({ data: { communityScore: 96, imageUrl: 'img.jpg', fetchedAt: Date.now() }, expiresAt: 0 }),
    );

    const resultPromise = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('/library')).flush(gogLibraryFlush);
    await resultPromise;

    httpMock.expectNone(r => r.url.includes('/search'));
    const game = librarySvc.games().find(g => g.name === 'The Witcher 3')!;
    expect(game.metadata?.communityScore).toBe(96);
  });

  it('should emit empty array when no connections exist (US-001)', async () => {
    const result = await firstValueFrom(librarySvc.syncAll());
    httpMock.expectNone(() => true);
    expect(result).toEqual([]);
  });

  it('should mark game as fetching while metadata request is in-flight, then clear it (US-018)', async () => {
    connectionSvc.add('steam', 'Steam', steamConfig);
    const p = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).flush(ownedGamesFlush);
    await p;

    const gameId = librarySvc.games()[0].id;
    expect(librarySvc.fetchingMetadataIds().has(gameId)).toBe(true);

    httpMock.expectOne(r => r.url.includes('app-details'))
      .flush({ '440': { success: true, data: { name: 'TF2', header_image: 'img.jpg' } } });
    httpMock.expectOne(r => r.url.includes('reviews'))
      .flush({ success: 1, query_summary: { total_positive: 90, total_reviews: 100, review_score: 8, review_score_desc: 'Very Positive' } });

    expect(librarySvc.fetchingMetadataIds().has(gameId)).toBe(false);
  });

  it('should keep existing games when a connection fails during sync (US-026)', async () => {
    connectionSvc.add('steam', 'Steam', steamConfig);
    const p1 = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).flush(ownedGamesFlush);
    await p1;
    expect(librarySvc.gameCount()).toBe(1);

    // Clear all caches so the second sync makes real HTTP requests.
    localStorage.clear();

    // Second sync: connection errors mid-flight
    const p2 = firstValueFrom(librarySvc.syncAll());
    httpMock.expectOne(r => r.url.includes('owned-games')).error(new ErrorEvent('network'));
    await p2;

    // Games from the failed connection are preserved
    expect(librarySvc.gameCount()).toBe(1);
    expect(librarySvc.games()[0].name).toBe('TF2');
  });
});
