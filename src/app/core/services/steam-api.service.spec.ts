import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { SteamApiService, STEAM_BACKEND_URL } from './steam-api.service';
import { CacheService } from './cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { SteamConnectionConfig } from '../models/store-connection.model';
import { Game } from '../models/game.model';

/** Execute the factory immediately (bypass queue/timers). */
function makeImmediateRateLimiter(): Partial<RateLimiterService> {
  return {
    delayMs: 0,
    queueLength: 0,
    enqueue: <T>(fn: () => Observable<T>) => fn(),
  };
}

const TEST_BACKEND = 'http://test-backend/api/steam';

describe('SteamApiService (US-002, US-005, US-006, US-011)', () => {
  let service: SteamApiService;
  let httpMock: HttpTestingController;
  let cache: CacheService;

  const config: SteamConnectionConfig = {
    apiKey: 'TESTKEY123',
    steamId: '76561198000000001',
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RateLimiterService, useValue: makeImmediateRateLimiter() },
        { provide: STEAM_BACKEND_URL, useValue: TEST_BACKEND },
      ],
    });
    service = TestBed.inject(SteamApiService);
    httpMock = TestBed.inject(HttpTestingController);
    cache = TestBed.inject(CacheService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ── US-002 / US-004 : owned games ────────────────────────────────────────

  it('should fetch owned games and convert minutes to hours (US-002, US-004)', async () => {
    const resultPromise = firstValueFrom(service.getOwnedGames(config, 'conn1'));
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/owned-games`).flush({
      response: {
        game_count: 2,
        games: [
          { appid: 440, name: 'TF2', playtime_forever: 120 },
          { appid: 730, name: 'CS2', playtime_forever: 6000 },
        ],
      },
    });

    const games = await resultPromise;
    expect(games).toHaveLength(2);
    expect(games[0].name).toBe('TF2');
    expect(games[0].hoursPlayed).toBe(2);
    expect(games[1].hoursPlayed).toBe(100);
    expect(games[0].storeId).toBe('conn1');
  });

  it('should route owned-games request through the backend proxy (US-011)', async () => {
    const resultPromise = firstValueFrom(service.getOwnedGames(config, 'conn1'));
    const req = httpMock.expectOne(r => r.url === `${TEST_BACKEND}/owned-games`);
    expect(req.request.params.get('key')).toBe('TESTKEY123');
    expect(req.request.params.get('steamid')).toBe('76561198000000001');
    req.flush({ response: { games: [] } });
    await resultPromise;
  });

  it('should return cached owned games without HTTP (US-006)', async () => {
    const cached: Game[] = [
      { id: 'conn1_440', appId: '440', storeId: 'conn1', name: 'TF2', hoursPlayed: 2 },
    ];
    cache.set('steam_owned_76561198000000001', cached, 60_000);

    const result = await firstValueFrom(service.getOwnedGames(config, 'conn1'));
    httpMock.expectNone(() => true);
    expect(result).toHaveLength(1);
  });

  // ── US-005 : metadata ────────────────────────────────────────────────────

  it('should fetch metadata via backend proxy (US-005, US-011)', async () => {
    const resultPromise = firstValueFrom(service.getAppMetadata('440'));

    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/app-details`).flush({
      '440': {
        success: true,
        data: {
          name: 'TF2',
          header_image: 'https://cdn.example.com/tf2.jpg',
          genres: [{ id: '1', description: 'Action' }],
          release_date: { coming_soon: false, date: '10 Oct, 2007' },
        },
      },
    });

    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/reviews/440`).flush({
      success: 1,
      query_summary: {
        total_positive: 90,
        total_reviews: 100,
        review_score: 8,
        review_score_desc: 'Very Positive',
      },
    });

    const meta = await resultPromise;
    expect(meta.imageUrl).toBe('https://cdn.example.com/tf2.jpg');
    expect(meta.yearPublished).toBe(2007);
    expect(meta.tags).toContain('Action');
    expect(meta.communityScore).toBe(90);
  });

  it('should return cached metadata without HTTP (US-006)', async () => {
    const cachedMeta = {
      imageUrl: 'img.jpg', communityScore: 85,
      yearPublished: 2000, tags: ['RPG'], fetchedAt: Date.now(),
    };
    cache.set('steam_meta_440', cachedMeta, 60_000);

    const meta = await firstValueFrom(service.getAppMetadata('440'));
    httpMock.expectNone(() => true);
    expect(meta.communityScore).toBe(85);
  });

  it('should set communityScore to undefined when total_reviews is 0 (US-005)', async () => {
    const resultPromise = firstValueFrom(service.getAppMetadata('1'));

    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/app-details`).flush({
      '1': { success: true, data: { name: 'X', header_image: '', release_date: { date: '2020' } } },
    });
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/reviews/1`).flush({
      success: 1,
      query_summary: { total_positive: 0, total_reviews: 0, review_score: 0, review_score_desc: '' },
    });

    const meta = await resultPromise;
    expect(meta.communityScore).toBeUndefined();
  });
});
