/**
 * US-023 – GOG API backend proxy routes.
 *
 * Tests all four GOG proxy routes using supertest + vi.mock for axios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';

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

  it('should include embed.gog.com/on_login_success?origin=client as redirect_uri', async () => {
    const res = await request(app).get('/api/gog/auth-url');
    expect(res.body.url).toContain(
      encodeURIComponent('https://embed.gog.com/on_login_success?origin=client'),
    );
  });
});

// ── POST /api/gog/token ──────────────────────────────────────────────────────

describe('POST /api/gog/token (US-023, US-035)', () => {
  it('should return 400 when code is missing', async () => {
    const res = await request(app).post('/api/gog/token').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/code/i);
  });

  it('should return credentials with no-store caching (US-035)', async () => {
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
    expect(res.headers['cache-control']).toBe('no-store');

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

describe('POST /api/gog/refresh (US-023, US-035)', () => {
  it('should return 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/gog/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refreshToken/i);
  });

  it('should return refreshed credentials with no-store caching (US-035)', async () => {
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
    expect(res.headers['cache-control']).toBe('no-store');

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

describe('GET /api/gog/library (US-023, US-035)', () => {
  it('should return 400 when authorization is missing (US-035)', async () => {
    const res = await request(app).get('/api/gog/library');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/authorization/i);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('should accept access tokens in authorization and return no-store (US-035)', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        totalPages: 1,
        products: [
          { id: 1207659069, title: 'Witcher 3', image: '//images-3.gog-statics.com/abc123.jpg' },
          { id: 1423049311, title: 'Cyberpunk 2077', image: 'https://images.gog.com/xyz.jpg' },
        ],
      },
    });

    const res = await request(app)
      .get('/api/gog/library')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(2);
    expect(res.headers['cache-control']).toBe('no-store');

    const witcher = res.body.games[0];
    expect(witcher.appId).toBe('1207659069');
    expect(witcher.name).toBe('Witcher 3');
    expect(witcher.hoursPlayed).toBe(0);
    expect(witcher.imageUrl).toBe('https://images-3.gog-statics.com/abc123.jpg'); // https: prepended

    const cyber = res.body.games[1];
    expect(cyber.appId).toBe('1423049311');
    expect(cyber.imageUrl).toBe('https://images.gog.com/xyz.jpg'); // full URL kept

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('embed.gog.com/account/getFilteredProducts'),
      expect.objectContaining({
        params: expect.objectContaining({ mediaType: 1, page: 1 }),
        headers: { Authorization: 'Bearer tok' },
      }),
    );
  });

  it('should paginate across multiple pages', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        totalPages: 2,
        products: [{ id: 1, title: 'Game One', image: '' }],
      },
    });
    mockGet.mockResolvedValueOnce({
      data: {
        totalPages: 2,
        products: [{ id: 2, title: 'Game Two', image: '' }],
      },
    });

    const res = await request(app)
      .get('/api/gog/library')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(2);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('should forward upstream errors', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    const res = await request(app).get('/api/gog/library').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(502);
  });
});
