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
      const status = err.response.status;
      console.error(`[Steam] upstream HTTP ${status}`);
      res.status(status).json({ error: err.response.statusText });
    } else if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
      console.error('[Steam] upstream request timed out');
      res.status(504).json({ error: 'Upstream request timed out' });
    } else {
      console.error('[Steam] upstream request failed', err.code);
      res.status(502).json({ error: 'Upstream request failed' });
    }
  } else {
    console.error('[Steam] unexpected upstream error');
    res.status(502).json({ error: 'Upstream request failed' });
  }
}

steamRouter.get('/owned-games', async (req: Request, res: Response) => {
    const authorization = req.get('Authorization');
    const key = authorization?.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  const steamid = req.query.steamid as string | undefined;
  if (!key || !steamid) {
    res.status(400).json({ error: 'authorization header and steamid query param are required' });
    return;
  }
  res.set('Cache-Control', 'no-store');
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

/** GET /api/steam/search?term=<title> — search the Steam Store by game title */
steamRouter.get('/search', async (req: Request, res: Response) => {
  const term = req.query.term as string;
  if (!term?.trim()) {
    res.status(400).json({ error: 'term query param is required' });
    return;
  }
  try {
    const { data } = await axios.get(`${STEAM_STORE_BASE}/api/storesearch/`, {
      params: { term, l: 'english', cc: 'US' },
      timeout: UPSTREAM_TIMEOUT_MS,
    });
    const candidates = (data.items ?? []).map(
      (item: { id: number; name: string; tiny_image?: string }) => ({
        appId: String(item.id),
        name: item.name,
        imageUrl: item.tiny_image,
      }),
    );
    res.json({ candidates });
  } catch (err) {
    forwardError(res, err);
  }
});

steamRouter.get('/reviews/:appid', async (req: Request, res: Response) => {
  const appid = req.params.appid as string;
  if (!/^\d+$/.test(appid)) {
    res.status(400).json({ error: 'appid must be numeric' });
    return;
  }
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
