/**
 * US-012 – Epic Games API backend proxy routes.
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

const ENV = {
  EPIC_CLIENT_ID: 'test-client-id',
  EPIC_CLIENT_SECRET: 'test-secret',
  EPIC_REDIRECT_URI: 'http://localhost:4200/epic-callback',
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(process.env, ENV);
});

// ── GET /api/epic/auth-url ───────────────────────────────────────────────────

describe('GET /api/epic/auth-url (US-012)', () => {
  it('should return an Epic authorization URL', async () => {
    const res = await request(app).get('/api/epic/auth-url');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('epicgames.com');
    expect(res.body.url).toContain(encodeURIComponent(ENV.EPIC_CLIENT_ID));
  });

  it('should return 503 when env vars are missing', async () => {
    delete process.env['EPIC_CLIENT_ID'];
    const res = await request(app).get('/api/epic/auth-url');
    expect(res.status).toBe(503);
  });
});

// ── POST /api/epic/token ─────────────────────────────────────────────────────

describe('POST /api/epic/token (US-012)', () => {
  it('should return 400 when code is missing', async () => {
    const res = await request(app).post('/api/epic/token').send({});
    expect(res.status).toBe(400);
  });

  it('should exchange code for tokens', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        account_id: 'acc123',
        displayName: 'TestUser',
        access_token: 'at_abc',
        refresh_token: 'rt_xyz',
        expires_in: 7200,
      },
    });

    const res = await request(app).post('/api/epic/token').send({ code: 'AUTH_CODE' });
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe('acc123');
    expect(res.body.accessToken).toBe('at_abc');
    expect(res.body.refreshToken).toBe('rt_xyz');
    expect(typeof res.body.expiresAt).toBe('number');
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

    const res = await request(app)
      .post('/api/epic/refresh')
      .send({ refreshToken: 'old_rt' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new_at');
  });
});

// ── GET /api/epic/library/:accountId ────────────────────────────────────────

describe('GET /api/epic/library/:accountId (US-012)', () => {
  it('should return 400 when accessToken is missing', async () => {
    const res = await request(app).get('/api/epic/library/acc123');
    expect(res.status).toBe(400);
  });

  it('should return list of games from entitlements', async () => {
    // First call: entitlements
    mockGet.mockResolvedValueOnce({
      data: {
        elements: [
          {
            id: 'ent1',
            entitlementName: 'fortnite',
            namespace: 'fn',
            catalogItemId: 'cat1',
            status: 'ACTIVE',
            active: true,
          },
        ],
      },
    });
    // Second call: catalog lookup
    mockGet.mockResolvedValueOnce({
      data: {
        cat1: {
          id: 'cat1',
          title: 'Fortnite',
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
    expect(res.body.games[0].hoursPlayed).toBe(0);
    expect(res.body.games[0].imageUrl).toBe('https://img.example.com/fn.jpg');
  });

  it('should return empty games list when no entitlements', async () => {
    mockGet.mockResolvedValueOnce({ data: { elements: [] } });

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(0);
  });

  it('should fall back to entitlementName when catalog lookup fails', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        elements: [
          {
            id: 'ent1',
            entitlementName: 'my-game',
            namespace: 'ns1',
            catalogItemId: 'cat2',
            status: 'ACTIVE',
            active: true,
          },
        ],
      },
    });
    mockGet.mockRejectedValueOnce(new Error('catalog unavailable'));

    const res = await request(app)
      .get('/api/epic/library/acc123')
      .query({ accessToken: 'valid_token' });

    expect(res.status).toBe(200);
    expect(res.body.games[0].name).toBe('my-game');
  });
});
