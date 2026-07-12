import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { vi, afterEach as vitestAfterEach } from 'vitest';
import { SteamApiService, STEAM_BACKEND_URL } from './steam-api.service';
import { CacheService } from './cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { SteamConnectionConfig } from '../models/store-connection.model';
import { LoggingService } from './logging.service';

/** Execute the factory immediately (bypass queue/timers). */
function makeImmediateRateLimiter(): Partial<RateLimiterService> {
  return {
    delayMs: 0,
    queueLength: 0,
    enqueue: <T>(fn: () => Observable<T>) => fn(),
  };
}

const TEST_BACKEND = 'http://test-backend/api/steam';

describe('SteamApiService (US-002, US-005, US-006, US-011, US-035, US-039, US-041)', () => {
  let service: SteamApiService;
  let httpMock: HttpTestingController;
  let cache: CacheService;
  let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const config: SteamConnectionConfig = {
    apiKey: 'TESTKEY123',
    steamId: '76561198000000001',
  };

  beforeEach(() => {
    localStorage.clear();
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RateLimiterService, useValue: makeImmediateRateLimiter() },
        { provide: STEAM_BACKEND_URL, useValue: TEST_BACKEND },
        { provide: LoggingService, useValue: logger },
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

  it('should send the Steam API key in authorization instead of the URL (US-035)', async () => {
    const resultPromise = firstValueFrom(service.getOwnedGames(config, 'conn1'));
    const req = httpMock.expectOne(r => r.url === `${TEST_BACKEND}/owned-games`);
    expect(req.request.params.has('key')).toBe(false);
    expect(req.request.params.get('steamid')).toBe('76561198000000001');
    expect(req.request.headers.get('Authorization')).toBe('Bearer TESTKEY123');
    expect(req.request.urlWithParams).not.toContain('TESTKEY123');
    req.flush({ response: { games: [] } });
    await resultPromise;
  });

  it('should omit credential-bearing HTTP error details from logs (US-035)', async () => {
    const resultPromise = firstValueFrom(service.getOwnedGames(config, 'conn1')).catch(() => undefined);
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/owned-games`).flush(
      { error: 'Forbidden', detail: 'TESTKEY123' },
      { status: 403, statusText: 'Forbidden' },
    );
    await resultPromise;
    expect(logger.error).toHaveBeenCalledWith('Steam', 'owned-games failed — HTTP 403');
  });

  it('should cache connection-independent games and remap every read (US-039)', async () => {
    const firstPromise = firstValueFrom(service.getOwnedGames(config, 'removed-connection'));
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/owned-games`).flush({
      response: { games: [{ appid: 440, name: 'TF2', playtime_forever: 120 }] },
    });
    const first = await firstPromise;
    expect(first[0]).toMatchObject({ id: 'removed-connection_440', storeId: 'removed-connection' });

    const cached = cache.get<Array<Record<string, unknown>>>('steam_owned_76561198000000001');
    expect(cached?.[0]).toEqual({ appId: '440', name: 'TF2', hoursPlayed: 2 });
    expect(cached?.[0]).not.toHaveProperty('id');
    expect(cached?.[0]).not.toHaveProperty('storeId');

    const remapped = await firstValueFrom(service.getOwnedGames(config, 'current-connection'));
    httpMock.expectNone(() => true);
    expect(remapped[0]).toMatchObject({ id: 'current-connection_440', storeId: 'current-connection' });
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

  it('should return and permanently cache partial metadata when reviews fail (US-041)', async () => {
    const resultPromise = firstValueFrom(service.getAppMetadata('41'));

    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/app-details`).flush({
      '41': {
        success: true,
        data: {
          name: 'Partial Game',
          header_image: 'partial.jpg',
          genres: [{ id: '1', description: 'RPG' }],
          release_date: { coming_soon: false, date: '2021' },
        },
      },
    });
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/reviews/41`).flush(
      { error: 'Unavailable', detail: 'credential-bearing detail' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    const metadata = await resultPromise;
    expect(metadata).toMatchObject({ imageUrl: 'partial.jpg', yearPublished: 2021, tags: ['RPG'] });
    expect(metadata).not.toHaveProperty('communityScore');
    expect(JSON.parse(localStorage.getItem('gamesync_cache_steam_meta_41')!).expiresAt).toBe(0);
    expect(logger.error).toHaveBeenCalledWith('Steam', 'reviews failed for appId=41 — HTTP 503');

    const cached = await firstValueFrom(service.getAppMetadata('41'));
    httpMock.expectNone(() => true);
    expect(cached).toEqual(metadata);
  });

  // ── US-017 : permanent cache ─────────────────────────────────────────────

  it('should store metadata with permanent cache (expiresAt=0, never evicted) (US-017)', async () => {
    const resultPromise = firstValueFrom(service.getAppMetadata('999'));

    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/app-details`).flush({
      '999': { success: true, data: { name: 'Game', header_image: 'img.jpg' } },
    });
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/reviews/999`).flush({
      success: 1,
      query_summary: { total_positive: 80, total_reviews: 100, review_score: 8, review_score_desc: 'Positive' },
    });

    await resultPromise;

    const raw = localStorage.getItem('gamesync_cache_steam_meta_999');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).expiresAt).toBe(0);

    // Should still be retrievable without HTTP on a second call
    const meta2 = await firstValueFrom(service.getAppMetadata('999'));
    httpMock.expectNone(() => true);
    expect(meta2.imageUrl).toBe('img.jpg');
  });

  // ── US-022 : Steam Store search ─────────────────────────────────────────

  it('should call /search and return candidates (US-022)', async () => {
    const resultPromise = firstValueFrom(service.searchStore('Fortnite'));

    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/search`).flush({
      candidates: [{ appId: '1691700', name: 'Fortnite', imageUrl: 'img.jpg' }],
    });

    const candidates = await resultPromise;
    expect(candidates).toHaveLength(1);
    expect(candidates[0].appId).toBe('1691700');
    expect(candidates[0].name).toBe('Fortnite');
  });

  it('should return empty array when search yields no candidates (US-022)', async () => {
    const resultPromise = firstValueFrom(service.searchStore('zzz-no-match'));
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/search`).flush({ candidates: [] });
    const candidates = await resultPromise;
    expect(candidates).toHaveLength(0);
  });

  // ── US-022 : match/candidate cache helpers ────────────────────────────────

  it('should store and retrieve confirmed match (US-022)', () => {
    expect(service.getConfirmedMatch('game_1')).toBeNull();
    service.setConfirmedMatch('game_1', '1691700');
    expect(service.getConfirmedMatch('game_1')).toBe('1691700');
  });

  it('should store, retrieve, and clear candidates (US-022)', () => {
    const candidates = [{ appId: '1691700', name: 'Fortnite' }];
    expect(service.getCachedCandidates('game_2')).toBeNull();
    service.setCachedCandidates('game_2', candidates);
    expect(service.getCachedCandidates('game_2')).toEqual(candidates);
    service.clearCandidates('game_2');
    expect(service.getCachedCandidates('game_2')).toBeNull();
  });

  // ── US-017 : 429 retry ───────────────────────────────────────────────────

  it('should retry app-details on 429 and succeed on retry (US-017)', async () => {
    vi.useFakeTimers();
    const resultPromise = firstValueFrom(service.getAppMetadata('440'));

    // First attempt → 429
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/app-details`)
      .flush('Rate limited', { status: 429, statusText: 'Too Many Requests' });

    // Advance past the 2 s back-off (attempt 1 → 2^1 * 1000 ms)
    await vi.advanceTimersByTimeAsync(2100);

    // Retry attempt → success
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/app-details`).flush({
      '440': { success: true, data: { name: 'TF2', header_image: 'img.jpg' } },
    });
    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/reviews/440`).flush({
      success: 1,
      query_summary: { total_positive: 90, total_reviews: 100, review_score: 8, review_score_desc: 'Very Positive' },
    });

    vi.useRealTimers();
    const meta = await resultPromise;
    expect(meta.imageUrl).toBe('img.jpg');
  });

  it('should not retry non-429 errors (US-017)', async () => {
    let caughtErr: unknown;
    const resultPromise = firstValueFrom(service.getAppMetadata('440'))
      .catch(e => { caughtErr = e; });

    httpMock.expectOne(r => r.url === `${TEST_BACKEND}/app-details`)
      .flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    await resultPromise;
    // No retry — no further requests expected
    httpMock.expectNone(() => true);
    expect(caughtErr).toBeDefined();
  });
});
