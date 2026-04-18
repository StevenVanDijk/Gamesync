/**
 * US-028 – Azure Blob CSV library proxy route.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

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

beforeEach(() => vi.clearAllMocks());

const ENCODED_URL = encodeURIComponent('https://mystorage.blob.core.windows.net/c/games.csv?sv=test');

const CSV_BASIC = `name,source,playtime
Team Fortress 2,steam,120.5
The Witcher 3,gog,34
Fortnite,epic,0
`;

describe('GET /api/blob/library (US-028)', () => {
  it('should return 400 when url param is missing', async () => {
    const res = await request(app).get('/api/blob/library');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/url/i);
  });

  it('should fetch the blob URL and return parsed games', async () => {
    mockGet.mockResolvedValueOnce({ data: CSV_BASIC });

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(3);

    expect(res.body.games[0]).toMatchObject({ name: 'Team Fortress 2', source: 'steam', hoursPlayed: 120.5 });
    expect(res.body.games[1]).toMatchObject({ name: 'The Witcher 3', source: 'gog', hoursPlayed: 34 });
    expect(res.body.games[2]).toMatchObject({ name: 'Fortnite', source: 'epic', hoursPlayed: 0 });

    expect(mockGet).toHaveBeenCalledWith(
      decodeURIComponent(ENCODED_URL),
      expect.objectContaining({ responseType: 'text' }),
    );
  });

  it('should handle semicolon-delimited CSV', async () => {
    const csv = `name;source;playtime\nDiablo IV;battlenet;22\n`;
    mockGet.mockResolvedValueOnce({ data: csv });

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.status).toBe(200);
    expect(res.body.games[0]).toMatchObject({ name: 'Diablo IV', source: 'battlenet', hoursPlayed: 22 });
  });

  it('should handle quoted CSV fields', async () => {
    const csv = `name,source,playtime\n"Assassin's Creed: Origins",ubisoft,15\n`;
    mockGet.mockResolvedValueOnce({ data: csv });

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.status).toBe(200);
    expect(res.body.games[0].name).toBe("Assassin's Creed: Origins");
  });

  it('should skip rows with an empty name', async () => {
    const csv = `name,source,playtime\nValid Game,steam,5\n,gog,10\n`;
    mockGet.mockResolvedValueOnce({ data: csv });

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
  });

  it('should clamp negative playtime to 0', async () => {
    const csv = `name,source,playtime\nBad Data,steam,-5\n`;
    mockGet.mockResolvedValueOnce({ data: csv });

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.body.games[0].hoursPlayed).toBe(0);
  });

  it('should return 502 when the blob URL is unreachable', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.status).toBe(502);
  });

  it('should forward upstream HTTP errors', async () => {
    const { AxiosError } = await import('axios');
    const err = new AxiosError('Forbidden');
    (err as any).response = { status: 403, statusText: 'Forbidden', data: 'Access denied' };
    mockGet.mockRejectedValueOnce(err);

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.status).toBe(403);
  });

  it('should parse a Playnite export and convert playtime from seconds to hours', async () => {
    const csv = [
      '#TYPE Selected.Playnite.SDK.Models.Game',
      '"Name","Source","ReleaseDate","Playtime","IsInstalled"',
      '"Team Fortress 2","Steam","15/01/2007","432000","True"',
      '"The Witcher 3","GOG","26/05/2015","7200","False"',
      '"[REDACTED]","Epic",,"0","False"',
    ].join('\n');
    mockGet.mockResolvedValueOnce({ data: csv });

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(3);
    // 432000 s ÷ 3600 = 120 h
    expect(res.body.games[0]).toMatchObject({ name: 'Team Fortress 2', source: 'steam', hoursPlayed: 120 });
    // 7200 s ÷ 3600 = 2 h
    expect(res.body.games[1]).toMatchObject({ name: 'The Witcher 3', source: 'gog', hoursPlayed: 2 });
    // 0 s = 0 h; empty release date field handled correctly
    expect(res.body.games[2]).toMatchObject({ name: '[REDACTED]', source: 'epic', hoursPlayed: 0 });
  });

  it('should include isInstalled from Playnite export (US-029)', async () => {
    const csv = [
      '#TYPE Selected.Playnite.SDK.Models.Game',
      '"Name","Source","Playtime","IsInstalled"',
      '"Team Fortress 2","Steam","0","True"',
      '"Fortnite","Epic","0","False"',
    ].join('\n');
    mockGet.mockResolvedValueOnce({ data: csv });

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.status).toBe(200);
    expect(res.body.games[0]).toMatchObject({ name: 'Team Fortress 2', isInstalled: true });
    expect(res.body.games[1]).toMatchObject({ name: 'Fortnite', isInstalled: false });
  });

  it('should omit isInstalled when IsInstalled column is absent (US-029)', async () => {
    mockGet.mockResolvedValueOnce({ data: CSV_BASIC });

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.status).toBe(200);
    expect(res.body.games[0]).not.toHaveProperty('isInstalled');
  });

  it('should handle Playnite export with leading space in name', async () => {
    const csv = [
      '#TYPE Selected.Playnite.SDK.Models.Game',
      '"Name","Source","Playtime"',
      '" Wanba Warriors","Steam","3600"',
    ].join('\n');
    mockGet.mockResolvedValueOnce({ data: csv });

    const res = await request(app).get('/api/blob/library').query({ url: ENCODED_URL });
    expect(res.status).toBe(200);
    // Leading space inside quotes is trimmed by the parser
    expect(res.body.games[0].name).toBe('Wanba Warriors');
    expect(res.body.games[0].hoursPlayed).toBe(1);
  });
});
