/**
 * US-012 – Epic Games API backend proxy routes (launcher client flow).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

vi.mock('axios', () => {
  const axiosGet = vi.fn();
  const axiosPost = vi.fn();
  class MockAxiosError extends Error {
    readonly isAxiosError = true;
    response?: { status: number; statusText: string; data?: unknown };
    code?: string;
  }
  return {
    default: {
      get: axiosGet,
      post: axiosPost,
      isAxiosError: (val: unknown) =>
        !!val && (val as MockAxiosError).isAxiosError === true,
    },
    AxiosError: MockAxiosError,
  };
});

import axios from 'axios';
const mockGet = vi.mocked(axios.get);
const mockPost = vi.mocked(axios.post);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/epic/auth-url ───────────────────────────────────────────────────

describe('GET /api/epic/auth-url (US-012)', () => {
  it('should return an Epic login URL containing the public client ID', async () => {
    const res = await request(app).get('/api/epic/auth-url');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('epicgames.com/id/login');
    expect(res.body.url).toContain('34a02cf8f4414e29b15921876da36f9a');
  });

  it('should include responseType=code in the redirect URL', async () => {
    const res = await request(app).get('/api/epic/auth-url');
    expect(res.body.url).toContain('responseType%3Dcode');
  });
});

// ── POST /api/epic/token ─────────────────────────────────────────────────────

describe('POST /api/epic/token (US-012)', () => {
  it('should return 400 when code is missing', async () => {
    const res = await request(app).post('/api/epic/token').send({});
    expect(res.status).toBe(400);
  });

  it('should exchange authorization code for tokens using launcher client', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        account_id: 'acc123',
        displayName: 'TestUser',
        access_token: 'at_abc',
        refresh_token: 'rt_xyz',
        expires_in: 7200,
        token_type: 'bearer',
      },
    });

    const res = await request(app).post('/api/epic/token').send({ code: 'AUTH_CODE' });
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe('acc123');
    expect(res.body.accessToken).toBe('at_abc');
    expect(res.body.refreshToken).toBe('rt_xyz');
    expect(typeof res.body.expiresAt).toBe('number');

    // Should use the Epic launcher token endpoint, not api.epicgames.dev
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('account-public-service-prod03.ol.epicgames.com'),
      expect.stringContaining('grant_type=authorization_code'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('basic '),
        }),
      }),
    );
  });
});

// ── POST /api/epic/refresh ───────────────────────────────────────────────────

describe('POST /api/epic/refresh (US-012)', () => {
  it('should return 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/epic/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('should exchange refresh token for new tokens', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        access_token: 'new_at',
        refresh_token: 'new_rt',
        expires_in: 7200,
      },
    });

    const res = await request(app).post('/api/epic/refresh').send({ refreshToken: 'old_rt' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new_at');
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('account-public-service-prod03.ol.epicgames.com'),
      expect.stringContaining('grant_type=refresh_token'),
      expect.any(Object),
    );
  });
});

// ── GET /api/epic/library/:accountId ────────────────────────────────────────

describe('GET /api/epic/library/:accountId (US-012)', () => {
  it('should return 400 when accessToken is missing', async () => {
    const res = await request(app).get('/api/epic/library/acc123');
    expect(res.status).toBe(400);
  });

  it('should fetch from library-service and return games', async () => {
    // Library items response
    mockGet.mockResolvedValueOnce({
      data: {
        records: [
          {
            appName: 'Fortnite',
            catalogItemId: 'cat1',
            '@namespace': 'fn',
            sandboxType: 'PUBLIC',
          },
        ],
        responseMetadata: { nextCursor: null },
      },
    });
    // Catalog lookup
    mockGet.mockResolvedValueOnce({
      data: {
        cat1: {
          id: 'cat1',
          title: 'Fortnite',
          categories: [{ path: 'games' }],
          keyImages: [{ type: 'DieselStoreFrontWide', url: 'https://img.example.com/fn.jpg' }],
        },
      },
    });

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].name).toBe('Fortnite');
    expect(res.body.games[0].appId).toBe('Fortnite');
    expect(res.body.games[0].hoursPlayed).toBe(0);
    expect(res.body.games[0].imageUrl).toBe('https://img.example.com/fn.jpg');

    // Should use the correct library endpoint
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('library-service.live.use1a.on.epicgames.com'),
      expect.any(Object),
    );
  });

  it('should filter out Unreal Engine namespace items', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        records: [
          { appName: 'UEPlugin', catalogItemId: 'c1', '@namespace': 'ue', sandboxType: 'PUBLIC' },
          { appName: 'MyGame', catalogItemId: 'c2', '@namespace': 'mygame', sandboxType: 'PUBLIC' },
        ],
        responseMetadata: { nextCursor: null },
      },
    });
    // Catalog for mygame namespace only
    mockGet.mockResolvedValueOnce({
      data: { c2: { id: 'c2', title: 'My Game', categories: [{ path: 'games' }] } },
    });

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].appId).toBe('MyGame');
  });

  it('should filter out PRIVATE sandbox items', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        records: [
          { appName: 'PrivateGame', catalogItemId: 'c1', '@namespace': 'ns1', sandboxType: 'PRIVATE' },
        ],
        responseMetadata: { nextCursor: null },
      },
    });

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(0);
  });

  it('should filter out plugins and digital extras from catalog categories', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        records: [
          { appName: 'SomePlugin', catalogItemId: 'c1', '@namespace': 'ns1', sandboxType: 'PUBLIC' },
        ],
        responseMetadata: { nextCursor: null },
      },
    });
    mockGet.mockResolvedValueOnce({
      data: {
        c1: { id: 'c1', title: 'Some Plugin', categories: [{ path: 'plugins/utility' }] },
      },
    });

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(0);
  });

  it('should return empty games list when no records', async () => {
    mockGet.mockResolvedValueOnce({
      data: { records: [], responseMetadata: { nextCursor: null } },
    });

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(0);
  });

  it('should fall back to appName when catalog request fails and appName is not a UUID', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        records: [
          { appName: 'Fortnite', catalogItemId: 'cat2', '@namespace': 'ns1', sandboxType: 'PUBLIC' },
        ],
        responseMetadata: { nextCursor: null },
      },
    });
    mockGet.mockRejectedValueOnce(new Error('catalog unavailable'));

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].name).toBe('Fortnite');
  });

  it('should drop UUID-appName items when catalog request fails', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        records: [
          { appName: 'b2d025b9212d4388ba2e3e5f1e8fc579', catalogItemId: 'cat3', '@namespace': 'ns1', sandboxType: 'PUBLIC' },
        ],
        responseMetadata: { nextCursor: null },
      },
    });
    mockGet.mockRejectedValueOnce(new Error('catalog unavailable'));

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(0);
  });

  it('should drop items whose catalog entry has no title (UUID-only records)', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        records: [
          { appName: 'b2d025b9212d4388ba2e3e5f1e8fc579', catalogItemId: 'c1', '@namespace': 'ns1', sandboxType: 'PUBLIC' },
          { appName: 'RealGame', catalogItemId: 'c2', '@namespace': 'ns1', sandboxType: 'PUBLIC' },
        ],
        responseMetadata: { nextCursor: null },
      },
    });
    mockGet.mockResolvedValueOnce({
      data: {
        // c1 has no title; c2 has a proper title
        c1: { id: 'c1', categories: [{ path: 'games' }] },
        c2: { id: 'c2', title: 'Real Game', categories: [{ path: 'games' }] },
      },
    });

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].name).toBe('Real Game');
  });
});
