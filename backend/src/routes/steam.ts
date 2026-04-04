import { Router, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';

export const steamRouter = Router();

const STEAM_API_BASE = 'https://api.steampowered.com';
const STEAM_STORE_BASE = 'https://store.steampowered.com';

function forwardError(res: Response, err: unknown): void {
  if (err instanceof AxiosError && err.response) {
    res.status(err.response.status).json({ error: err.response.statusText });
  } else {
    res.status(502).json({ error: 'Upstream request failed' });
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
    });
    res.json(data);
  } catch (err) {
    forwardError(res, err);
  }
});
