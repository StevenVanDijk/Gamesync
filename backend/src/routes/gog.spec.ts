/**
 * US-023 – GOG API backend proxy routes.
 *
 * Tests all four GOG proxy routes using supertest + vi.mock for axios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

// ── Mock axios ────────────────────────────────────────────────────────────────
vi.mock('axios', () => {
  const axiosGet = vi.fn();
  class MockAxiosError extends Error {
    readonly isAxiosError = true;
    response?: { status: number; statusText: string; data?: unknown };
    code?: string;
  }
  return {
    default: {
      get: axiosGet,
      isAxiosError: (val: unknown) =>
        !!val && (val as MockAxiosError).isAxiosError === true,
    },
    AxiosError: MockAxiosError,
  };
});

import axios from 'axios';
const mockGet = vi.mocked(axios.get);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/gog/auth-url ────────────────────────────────────────────────────

describe('GET /api/gog/auth-url (US-023)', () => {
  it('should return a GOG login URL containing the public client ID', async () => {
    const res = await request(app).get('/api/gog/auth-url');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('login.gog.com/auth');
    expect(res.body.url).toContain('46899977096215655');
  });

  it('should include gog.com/on_login_success as redirect_uri', async () => {
    const res = await request(app).get('/api/gog/auth-url');
    expect(res.body.url).toContain(encodeURIComponent('https://www.gog.com/on_login_success'));
  });
});

// ── POST /api/gog/token ──────────────────────────────────────────────────────

describe('POST /api/gog/token (US-023)', () => {
  it('should return 400 when code is missing', async () => {
    const res = await request(app).post('/api/gog/token').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/code/i);
  });

  it('should exchange authorization code for tokens and return user info', async () => {
    // First call: token endpoint
    mockGet.mockResolvedValueOnce({
      data: {
        access_token: 'at_gog_123',
        refresh_token: 'rt_gog_456',
        expires_in: 3600,
        user_id: '12345678',
      },
    });
    // Second call: userData.json
    mockGet.mockResolvedValueOnce({
      data: { username: 'GogUser' },
    });

    const res = await request(app).post('/api/gog/token').send({ code: 'AUTH_CODE' });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('12345678');
    expect(res.body.username).toBe('GogUser');
    expect(res.body.accessToken).toBe('at_gog_123');
    expect(res.body.refreshToken).toBe('rt_gog_456');
    expect(typeof res.body.expiresAt).toBe('number');
    expect(res.body.expiresAt).toBeGreaterThan(Date.now());

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('auth.gog.com/token'),
      expect.objectContaining({
        params: expect.objectContaining({
          grant_type: 'authorization_code',
          code: 'AUTH_CODE',
        }),
      }),
    );
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('userData.json'),
      expect.any(Object),
    );
  });

  it('should forward upstream errors from the token endpoint', async () => {
    const { AxiosError } = await import('axios');
    const err = new AxiosError('Unauthorized');
    (err as any).response = { status: 401, statusText: 'Unauthorized', data: 'invalid code' };
    mockGet.mockRejectedValueOnce(err);

    const res = await request(app).post('/api/gog/token').send({ code: 'bad_code' });
    expect(res.status).toBe(401);
  });
});

// ── POST /api/gog/refresh ────────────────────────────────────────────────────

describe('POST /api/gog/refresh (US-023)', () => {
  it('should return 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/gog/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refreshToken/i);
  });

  it('should exchange refresh token for new tokens', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        access_token: 'new_at',
        refresh_token: 'new_rt',
        expires_in: 7200,
      },
    });

    const res = await request(app).post('/api/gog/refresh').send({ refreshToken: 'old_rt' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new_at');
    expect(res.body.refreshToken).toBe('new_rt');
    expect(typeof res.body.expiresAt).toBe('number');

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('auth.gog.com/token'),
      expect.objectContaining({
        params: expect.objectContaining({
          grant_type: 'refresh_token',
          refresh_token: 'old_rt',
        }),
      }),
    );
  });

  it('should forward upstream errors', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    const res = await request(app).post('/api/gog/refresh').send({ refreshToken: 'rt' });
    expect(res.status).toBe(502);
  });
});

// ── GET /api/gog/library ─────────────────────────────────────────────────────

describe('GET /api/gog/library (US-023)', () => {
  it('should return 400 when accessToken or username is missing', async () => {
    const res1 = await request(app).get('/api/gog/library');
    expect(res1.status).toBe(400);

    const res2 = await request(app).get('/api/gog/library').query({ accessToken: 'tok' });
    expect(res2.status).toBe(400);

    const res3 = await request(app).get('/api/gog/library').query({ username: 'user' });
    expect(res3.status).toBe(400);
  });

  it('should fetch library and return games with playtime and imageUrl', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        pages: 1,
        _embedded: {
          items: [
            {
              game: { id: 'gog_1', title: 'Witcher 3', image: '/abc123' },
              stats: { playtime: 120 },
            },
            {
              game: { id: 'gog_2', title: 'Cyberpunk 2077', image: 'https://images.gog.com/xyz.jpg' },
              stats: null,
            },
          ],
        },
      },
    });

    const res = await request(app)
      .get('/api/gog/library')
      .query({ accessToken: 'tok', username: 'testuser' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(2);

    const witcher = res.body.games[0];
    expect(witcher.appId).toBe('gog_1');
    expect(witcher.name).toBe('Witcher 3');
    expect(witcher.hoursPlayed).toBe(2); // 120 min / 60
    expect(witcher.imageUrl).toBe('https://images.gog-statics.com/abc123');

    const cyber = res.body.games[1];
    expect(cyber.appId).toBe('gog_2');
    expect(cyber.hoursPlayed).toBe(0);
    expect(cyber.imageUrl).toBe('https://images.gog.com/xyz.jpg'); // full URL kept

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('gog.com/u/testuser/games/stats'),
      expect.any(Object),
    );
  });

  it('should paginate across multiple pages', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        pages: 2,
        _embedded: {
          items: [{ game: { id: 'g1', title: 'Game One', image: '' }, stats: null }],
        },
      },
    });
    mockGet.mockResolvedValueOnce({
      data: {
        pages: 2,
        _embedded: {
          items: [{ game: { id: 'g2', title: 'Game Two', image: '' }, stats: null }],
        },
      },
    });

    const res = await request(app)
      .get('/api/gog/library')
      .query({ accessToken: 'tok', username: 'user' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(2);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('should forward upstream errors', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    const res = await request(app)
      .get('/api/gog/library')
      .query({ accessToken: 'tok', username: 'user' });
    expect(res.status).toBe(502);
  });
});
