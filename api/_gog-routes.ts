/**
 * GOG Galaxy API proxy routes.
 *
 * Uses GOG's public Galaxy OAuth client — no developer app registration required.
 * The same client credentials are used by GOG Galaxy, Heroic Games Launcher,
 * LGOGDownloader, and other open-source GOG clients.
 *
 * Auth flow:
 *   1. Frontend opens the GOG login URL (GET /auth-url).
 *   2. After login GOG redirects to https://www.gog.com/on_login_success?code=<code>.
 *   3. User copies the code from the browser address bar and POSTs it to /api/gog/token.
 *   4. Backend exchanges code → access + refresh tokens, then fetches the username.
 *   5. Subsequent library fetches use GET /api/gog/library?accessToken=...&username=...
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

export const gogRouter = Router();

// Public GOG Galaxy OAuth2 client credentials.
// Identical to those embedded in the GOG Galaxy launcher and widely documented
// in open-source projects (Heroic, LGOGDownloader, Playnite, etc.).
const GOG_CLIENT_ID = '46899977096215655';
const GOG_CLIENT_SECRET =
  '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';
const GOG_REDIRECT_URI = 'https://embed.gog.com/on_login_success?origin=client';

const GOG_AUTH_BASE = 'https://login.gog.com/auth';
const GOG_TOKEN_URL = 'https://auth.gog.com/token';
const GOG_EMBED_BASE = 'https://embed.gog.com';

const UPSTREAM_TIMEOUT_MS = 8_000;

function forwardError(res: Response, err: unknown): void {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const status = err.response.status;
      console.error(`[GOG] upstream HTTP ${status}`);
      res.status(status).json({ error: err.response.statusText });
    } else if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
      console.error('[GOG] upstream request timed out');
      res.status(504).json({ error: 'Upstream request timed out' });
    } else {
      console.error('[GOG] upstream request failed', err.code);
      res.status(502).json({ error: 'Upstream request failed' });
    }
  } else {
    console.error('[GOG] unexpected upstream error');
    res.status(502).json({ error: 'Upstream request failed' });
  }
}

/**
 * GET /api/gog/auth-url
 * Returns the URL the user should open to log in with GOG.
 * After logging in they are redirected to gog.com/on_login_success?code=<code>.
 * The user copies that code and pastes it into the app.
 */
gogRouter.get('/auth-url', (_req: Request, res: Response) => {
  const url =
    `${GOG_AUTH_BASE}?client_id=${GOG_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(GOG_REDIRECT_URI)}` +
    `&response_type=code&layout=client2`;
  res.json({ url });
});

/**
 * POST /api/gog/token
 * Exchanges an authorization code for access + refresh tokens.
 * Also fetches the GOG username for use in subsequent library calls.
 * Body: { code: string }
 */
gogRouter.post('/token', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ error: 'code is required' });
    return;
  }

  try {
    // GOG uses a GET request for its token endpoint (atypical but documented).
    const { data: tokenData } = await axios.get(GOG_TOKEN_URL, {
      params: {
        client_id: GOG_CLIENT_ID,
        client_secret: GOG_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: GOG_REDIRECT_URI,
      },
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string;
    const expiresIn = tokenData.expires_in as number;
    const userId = String(tokenData.user_id ?? '');

    // Fetch the username — needed to query the library stats endpoint later.
    const { data: userData } = await axios.get(`${GOG_EMBED_BASE}/userData.json`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    const username = userData.username as string;

    res.json({
      userId,
      username,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1_000,
    });
  } catch (err) {
    forwardError(res, err);
  }
});

/**
 * POST /api/gog/refresh
 * Refreshes an access token using a refresh token.
 * Body: { refreshToken: string }
 */
gogRouter.post('/refresh', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }

  try {
    const { data } = await axios.get(GOG_TOKEN_URL, {
      params: {
        client_id: GOG_CLIENT_ID,
        client_secret: GOG_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    res.json({
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1_000,
    });
  } catch (err) {
    forwardError(res, err);
  }
});

gogRouter.get('/library', async (req: Request, res: Response) => {
  const authorization = req.get('Authorization');
    const authorization = req.get('Authorization');
    const accessToken = authorization?.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';

  if (!accessToken) {
    res.status(400).json({ error: 'authorization header is required' });
    return;
  }

  res.set('Cache-Control', 'no-store');
  const authHeader = `Bearer ${accessToken}`;

  try {
    interface GogProduct {
      id: number;
      title: string;
      /** Protocol-relative URL, e.g. //images-3.gog-statics.com/<hash>.jpg */
      image: string;
    }

    const products: GogProduct[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const { data } = await axios.get(
        `${GOG_EMBED_BASE}/account/getFilteredProducts`,
        {
          params: { mediaType: 1, page },
          headers: { Authorization: authHeader },
          timeout: UPSTREAM_TIMEOUT_MS,
        },
      );

      const items: GogProduct[] = data.products ?? [];
      products.push(...items);
      totalPages = data.totalPages ?? 1;
      page++;
    } while (page <= totalPages);

    const result = products.map(product => {
      // GOG returns protocol-relative URLs (//images-3.gog-statics.com/...)
      const rawImage = product.image ?? '';
      const imageUrl = rawImage
        ? rawImage.startsWith('http')
          ? rawImage
          : `https:${rawImage}`
        : undefined;

      return {
        appId: String(product.id),
        name: product.title,
        hoursPlayed: 0,
        imageUrl,
      };
    });

    res.json({ games: result });
  } catch (err) {
    forwardError(res, err);
  }
});
