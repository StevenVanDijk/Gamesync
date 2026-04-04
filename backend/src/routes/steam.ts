import { Router, Request, Response } from 'express';
import axios from 'axios';

export const steamRouter = Router();

const STEAM_API_BASE = 'https://api.steampowered.com';
const STEAM_STORE_BASE = 'https://store.steampowered.com';

/** Timeout for upstream Steam requests (must stay well under Vercel's 10 s limit). */
const UPSTREAM_TIMEOUT_MS = 8_000;

function forwardError(res: Response, err: unknown): void {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      // Upstream returned an HTTP error
      const status = err.response.status;
      const detail = typeof err.response.data === 'string'
        ? err.response.data.slice(0, 200)   // trim HTML error pages
        : JSON.stringify(err.response.data ?? {});
      console.error(`[Steam] upstream HTTP ${status}:`, detail);
      res.status(status).json({ error: err.response.statusText, detail });
    } else if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
      console.error('[Steam] upstream request timed out:', err.message);
      res.status(504).json({ error: 'Upstream request timed out' });
    } else {
      console.error('[Steam] axios error (no response):', err.code, err.message);
      res.status(502).json({ error: 'Upstream request failed', detail: err.message });
    }
  } else {
    console.error('[Steam] unexpected error:', err);
    res.status(502).json({ error: 'Upstream request failed', detail: String(err) });
  }
}

/** GET /api/steam/owned-games?key=<key>&steamid=<id> */
steamRouter.get('/owned-games', async (req: Request, res: Response) => {
  const { key, steamid } = req.query;
  if (!key || !steamid) {
    res.status(400).json({ error: 'key and steamid query params are required' });
    return;
  }
  try {
    const { data } = await axios.get(`${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`, {
      params: { key, steamid, include_appinfo: 1, include_played_free_games: 1, format: 'json' },
      timeout: UPSTREAM_TIMEOUT_MS,
    });
    res.json(data);
  } catch (err) {
    forwardError(res, err);
  }
});

/** GET /api/steam/app-details?appids=<id> */
steamRouter.get('/app-details', async (req: Request, res: Response) => {
  const { appids } = req.query;
  if (!appids) {
    res.status(400).json({ error: 'appids query param is required' });
    return;
  }
  try {
    const { data } = await axios.get(`${STEAM_STORE_BASE}/api/appdetails`, {
      params: { appids, cc: 'us', l: 'en' },
      timeout: UPSTREAM_TIMEOUT_MS,
    });
    res.json(data);
  } catch (err) {
    forwardError(res, err);
  }
});

/** GET /api/steam/reviews/:appid */
steamRouter.get('/reviews/:appid', async (req: Request, res: Response) => {
  const { appid } = req.params;
  try {
    const { data } = await axios.get(`${STEAM_STORE_BASE}/appreviews/${appid}`, {
      params: { json: 1, language: 'all', purchase_type: 'all' },
      timeout: UPSTREAM_TIMEOUT_MS,
    });
    res.json(data);
  } catch (err) {
    forwardError(res, err);
  }
});
