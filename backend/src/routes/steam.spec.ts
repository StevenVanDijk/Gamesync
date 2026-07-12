/**
 * US-011 – Backend proxy for Steam API.
 *
 * Tests the three proxy routes using supertest + vi.mock for axios.
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
const mockAxiosGet = vi.mocked(axios.get);

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/steam/owned-games (US-011, US-035)', () => {
  it('should return 400 when authorization or steamid is missing (US-035)', async () => {
    const res = await request(app).get('/api/steam/owned-games');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/authorization.*steamid/i);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('should accept the API key in a header and mark the response no-store (US-035)', async () => {
    const steamResponse = {
      response: { game_count: 1, games: [{ appid: 440, name: 'TF2', playtime_forever: 120 }] },
    };
    mockAxiosGet.mockResolvedValueOnce({ data: steamResponse });

    const res = await request(app)
      .get('/api/steam/owned-games')
      .set('Authorization', 'Bearer TESTKEY')
      .query({ steamid: '76561198000000001' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(steamResponse);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining('IPlayerService/GetOwnedGames'),
      expect.objectContaining({ params: expect.objectContaining({ key: 'TESTKEY' }) }),
    );
  });

  it('should forward upstream HTTP errors', async () => {
    const { AxiosError } = await import('axios');
    const err = new AxiosError('Forbidden');
    (err as any).response = { status: 403, statusText: 'Forbidden' };
    mockAxiosGet.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/steam/owned-games')
      .set('Authorization', 'Bearer BAD')
      .query({ steamid: '123' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/steam/app-details (US-011)', () => {
  it('should return 400 when appids is missing', async () => {
    const res = await request(app).get('/api/steam/app-details');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/appids/i);
  });

  it('should proxy request to Steam Store API and return data', async () => {
    const detailsResponse = {
      '440': { success: true, data: { name: 'TF2', header_image: 'img.jpg' } },
    };
    mockAxiosGet.mockResolvedValueOnce({ data: detailsResponse });

    const res = await request(app)
      .get('/api/steam/app-details')
      .query({ appids: '440' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(detailsResponse);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining('appdetails'),
      expect.objectContaining({ params: expect.objectContaining({ appids: '440' }) }),
    );
  });
});

describe('GET /api/steam/search (US-022)', () => {
  it('should return 400 when term is missing', async () => {
    const res = await request(app).get('/api/steam/search');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/term/i);
  });

  it('should proxy to Steam storesearch and return candidates', async () => {
    const storeResponse = {
      total: 1,
      items: [{ id: 271590, name: 'Grand Theft Auto V', tiny_image: 'img.jpg' }],
    };
    mockAxiosGet.mockResolvedValueOnce({ data: storeResponse });

    const res = await request(app).get('/api/steam/search').query({ term: 'GTA V' });

    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.candidates[0]).toMatchObject({ appId: '271590', name: 'Grand Theft Auto V', imageUrl: 'img.jpg' });
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining('storesearch'),
      expect.objectContaining({ params: expect.objectContaining({ term: 'GTA V' }) }),
    );
  });

  it('should return an empty candidates array when store returns no items', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { total: 0, items: [] } });
    const res = await request(app).get('/api/steam/search').query({ term: 'zzz-no-match' });
    expect(res.status).toBe(200);
    expect(res.body.candidates).toEqual([]);
  });

  it('should forward upstream errors from storesearch', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('network error'));
    const res = await request(app).get('/api/steam/search').query({ term: 'anything' });
    expect(res.status).toBe(502);
  });
});

describe('GET /api/steam/reviews/:appid (US-011)', () => {
  it('should proxy request to Steam reviews endpoint', async () => {
    const reviewsResponse = {
      success: 1,
      query_summary: { total_positive: 90, total_reviews: 100, review_score: 8 },
    };
    mockAxiosGet.mockResolvedValueOnce({ data: reviewsResponse });

    const res = await request(app).get('/api/steam/reviews/440');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(reviewsResponse);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining('appreviews/440'),
      expect.any(Object),
    );
  });

  it('should return 502 on non-HTTP upstream error', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('network error'));

    const res = await request(app).get('/api/steam/reviews/999');
    expect(res.status).toBe(502);
  });
});
