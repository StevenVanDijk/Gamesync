/**
 * US-011 – Backend proxy for Steam API.
 *
 * Tests the three proxy routes using supertest + vi.mock for axios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

// ── Mock axios ────────────────────────────────────────────────────────────────
vi.mock('axios', () => {
  const axiosGet = vi.fn();
  return { default: { get: axiosGet }, AxiosError: class AxiosError extends Error {} };
});

import axios from 'axios';
const mockAxiosGet = vi.mocked(axios.get);

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/steam/owned-games (US-011)', () => {
  it('should return 400 when key or steamid is missing', async () => {
    const res = await request(app).get('/api/steam/owned-games');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/key and steamid/i);
  });

  it('should proxy request to Steam Web API and return data', async () => {
    const steamResponse = {
      response: { game_count: 1, games: [{ appid: 440, name: 'TF2', playtime_forever: 120 }] },
    };
    mockAxiosGet.mockResolvedValueOnce({ data: steamResponse });

    const res = await request(app)
      .get('/api/steam/owned-games')
      .query({ key: 'TESTKEY', steamid: '76561198000000001' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(steamResponse);
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
      .query({ key: 'BAD', steamid: '123' });

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
