/**
 * US-023 – GogApiService unit tests.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { GogApiService, GOG_BACKEND_URL } from './gog-api.service';
import { StoreConnectionService } from './store-connection.service';
import { LoggingService } from './logging.service';
import { GogConnectionConfig } from '../models/store-connection.model';

const TEST_BACKEND = 'http://test-backend/api/gog';

const VALID_CONFIG: GogConnectionConfig = {
  userId: 'user123',
  username: 'TestGogUser',
  accessToken: 'at_valid',
  refreshToken: 'rt_valid',
  expiresAt: Date.now() + 3_600_000, // 1 hour from now
};

describe('GogApiService (US-023, US-035)', () => {
  let service: GogApiService;
  let httpMock: HttpTestingController;
  let connectionSvc: Partial<StoreConnectionService>;
  let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    connectionSvc = { update: vi.fn() };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GOG_BACKEND_URL, useValue: TEST_BACKEND },
        { provide: StoreConnectionService, useValue: connectionSvc },
        { provide: LoggingService, useValue: logger },
      ],
    });

    service = TestBed.inject(GogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getAuthUrl ───────────────────────────────────────────────────────────

  describe('getAuthUrl', () => {
    it('should GET /auth-url and return the url string', async () => {
      const p = firstValueFrom(service.getAuthUrl());
      httpMock.expectOne(`${TEST_BACKEND}/auth-url`).flush({ url: 'https://login.gog.com/auth?...' });
      await expect(p).resolves.toBe('https://login.gog.com/auth?...');
    });
  });

  // ── exchangeCode ─────────────────────────────────────────────────────────

  describe('exchangeCode', () => {
    it('should POST /token and return token response', async () => {
      const p = firstValueFrom(service.exchangeCode('MY_CODE'));
      const req = httpMock.expectOne(`${TEST_BACKEND}/token`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ code: 'MY_CODE' });

      req.flush({
        userId: 'u1',
        username: 'GogUser',
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: 9999999999,
      });

      const result = await p;
      expect(result.userId).toBe('u1');
      expect(result.username).toBe('GogUser');
      expect(result.accessToken).toBe('at');
    });
  });

  // ── getOwnedGames ────────────────────────────────────────────────────────

  describe('getOwnedGames', () => {
    it('should send the access token in authorization and map games (US-035)', async () => {
      const p = firstValueFrom(service.getOwnedGames(VALID_CONFIG, 'conn1', 'conn1'));

      const req = httpMock.expectOne(r => r.url === `${TEST_BACKEND}/library`);
      expect(req.request.params.has('accessToken')).toBe(false);
      expect(req.request.headers.get('Authorization')).toBe('Bearer at_valid');
      expect(req.request.urlWithParams).not.toContain('at_valid');

      req.flush({
        games: [
          { appId: 'gog_1', name: 'Witcher 3', hoursPlayed: 2, imageUrl: 'https://img.gog.com/w3.jpg' },
          { appId: 'gog_2', name: 'Cyberpunk 2077', hoursPlayed: 0 },
        ],
      });

      const games = await p;
      expect(games).toHaveLength(2);

      const w3 = games[0];
      expect(w3.id).toBe('conn1_gog_1');
      expect(w3.appId).toBe('gog_1');
      expect(w3.storeId).toBe('conn1');
      expect(w3.name).toBe('Witcher 3');
      expect(w3.hoursPlayed).toBe(2);
      expect(w3.metadata?.imageUrl).toBe('https://img.gog.com/w3.jpg');

      const cyber = games[1];
      expect(cyber.metadata).toBeUndefined();
    });

    it('should omit credential-bearing HTTP error details from logs (US-035)', async () => {
      const resultPromise = firstValueFrom(
        service.getOwnedGames(VALID_CONFIG, 'conn1', 'conn1'),
      ).catch(() => undefined);

      httpMock.expectOne(r => r.url === `${TEST_BACKEND}/library`).flush(
        { error: 'Unauthorized', detail: 'at_valid' },
        { status: 401, statusText: 'Unauthorized' },
      );
      await resultPromise;

      expect(logger.error).toHaveBeenCalledWith(
        'GOG',
        'library failed (username=TestGogUser) — HTTP 401',
      );
    });

    it('should refresh an expired token before fetching library', async () => {
      const expiredConfig: GogConnectionConfig = {
        ...VALID_CONFIG,
        accessToken: 'old_at',
        refreshToken: 'old_rt',
        expiresAt: Date.now() - 1000, // already expired
      };

      const p = firstValueFrom(service.getOwnedGames(expiredConfig, 'conn1', 'conn1'));

      // Expect refresh call first
      const refreshReq = httpMock.expectOne(`${TEST_BACKEND}/refresh`);
      expect(refreshReq.request.method).toBe('POST');
      expect(refreshReq.request.body).toEqual({ refreshToken: 'old_rt' });
      refreshReq.flush({
        accessToken: 'new_at',
        refreshToken: 'new_rt',
        expiresAt: Date.now() + 3_600_000,
      });

      // Then library call should use the refreshed token
      const libReq = httpMock.expectOne(r => r.url === `${TEST_BACKEND}/library`);
      expect(libReq.request.params.has('accessToken')).toBe(false);
      expect(libReq.request.headers.get('Authorization')).toBe('Bearer new_at');
      libReq.flush({ games: [] });

      const games = await p;
      expect(games).toHaveLength(0);

      // Connection should have been updated with new tokens
      expect(connectionSvc.update).toHaveBeenCalledWith(
        'conn1',
        expect.objectContaining({
          config: expect.objectContaining({ accessToken: 'new_at' }),
        }),
      );
    });
  });
});
