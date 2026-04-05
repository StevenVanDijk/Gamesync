/**
 * Epic Games API proxy routes.
 *
 * Uses Epic's public launcher OAuth client — no developer app registration required.
 * The same credentials are used by Playnite, Legendary, and other open-source clients.
 *
 * Auth flow:
 *   1. Frontend opens https://www.epicgames.com/id/login?redirectUrl=<redirect-api-url>
 *   2. After login, user lands on the Epic redirect page showing JSON with authorizationCode
 *   3. User copies that code and POSTs it to /api/epic/token
 *   4. Backend exchanges code for access + refresh tokens
 *   5. Subsequent library fetches use GET /api/epic/library/:accountId?accessToken=...
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

export const epicRouter = Router();

// Public Epic Launcher OAuth client credentials.
// These are the same credentials used by the Epic Games Launcher itself and are
// widely documented in open-source projects (Playnite, Legendary, etc.).
const EPIC_CLIENT_ID = '34a02cf8f4414e29b15921876da36f9a';
const EPIC_BASIC_AUTH =
  'MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=';

const EPIC_TOKEN_URL =
  'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token';
const EPIC_LIBRARY_URL =
  'https://library-service.live.use1a.on.epicgames.com/library/api/public/items';
const EPIC_CATALOG_BASE =
  'https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace';

const UPSTREAM_TIMEOUT_MS = 8_000;

function forwardError(res: Response, err: unknown): void {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const status = err.response.status;
      const detail =
        typeof err.response.data === 'string'
          ? err.response.data.slice(0, 200)
          : JSON.stringify(err.response.data ?? {});
      console.error(`[Epic] upstream HTTP ${status}:`, detail);
      res.status(status).json({ error: err.response.statusText, detail });
    } else if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
      console.error('[Epic] upstream request timed out:', err.message);
      res.status(504).json({ error: 'Upstream request timed out' });
    } else {
      console.error('[Epic] axios error (no response):', err.code, err.message);
      res.status(502).json({ error: 'Upstream request failed', detail: err.message });
    }
  } else {
    console.error('[Epic] unexpected error:', err);
    res.status(502).json({ error: 'Upstream request failed', detail: String(err) });
  }
}

/**
 * GET /api/epic/auth-url
 * Returns the URL the user should open to log in with Epic.
 * After logging in they will see a JSON page containing "authorizationCode".
 */
epicRouter.get('/auth-url', (_req: Request, res: Response) => {
  const redirectApiUrl =
    `https://www.epicgames.com/id/api/redirect` +
    `?clientId=${EPIC_CLIENT_ID}&responseType=code`;
  const loginUrl =
    `https://www.epicgames.com/id/login?redirectUrl=${encodeURIComponent(redirectApiUrl)}`;
  res.json({ url: loginUrl });
});

/**
 * POST /api/epic/token
 * Exchanges an authorization code for access + refresh tokens.
 * Body: { code: string }
 */
epicRouter.post('/token', async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ error: 'code is required' });
    return;
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      token_type: 'eg1',
    });

    const { data } = await axios.post(EPIC_TOKEN_URL, params.toString(), {
      headers: {
        Authorization: `basic ${EPIC_BASIC_AUTH}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    res.json({
      accountId: data.account_id as string,
      displayName: data.displayName as string | undefined,
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
    });
  } catch (err) {
    forwardError(res, err);
  }
});

/**
 * POST /api/epic/refresh
 * Refreshes an access token using a refresh token.
 * Body: { refreshToken: string }
 */
epicRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      token_type: 'eg1',
    });

    const { data } = await axios.post(EPIC_TOKEN_URL, params.toString(), {
      headers: {
        Authorization: `basic ${EPIC_BASIC_AUTH}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    res.json({
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
    });
  } catch (err) {
    forwardError(res, err);
  }
});

/**
 * GET /api/epic/library/:accountId
 * Returns the list of owned games for an Epic account.
 * Query: accessToken=<token>
 */
epicRouter.get('/library/:accountId', async (req: Request, res: Response) => {
  const { accessToken } = req.query as { accessToken?: string };

  if (!accessToken) {
    res.status(400).json({ error: 'accessToken query param is required' });
    return;
  }

  const authHeader = `Bearer ${accessToken}`;

  try {
    // ── Fetch all library records (paginated) ──────────────────────────────
    interface LibraryRecord {
      appName: string;
      catalogItemId: string;
      '@namespace': string;
      sandboxType: string;
    }

    const records: LibraryRecord[] = [];
    let cursor: string | undefined;

    do {
      const params: Record<string, string> = { includeMetadata: 'true' };
      if (cursor) params['cursor'] = cursor;

      const { data } = await axios.get(EPIC_LIBRARY_URL, {
        headers: { Authorization: authHeader },
        params,
        timeout: UPSTREAM_TIMEOUT_MS,
      });

      records.push(...((data.records ?? []) as LibraryRecord[]));
      cursor = (data.responseMetadata?.nextCursor as string | undefined) ?? undefined;
    } while (cursor);

    // ── Filter out UE assets, private sandboxes, and records with no appName
    const filtered = records.filter(
      r => r.appName && r['@namespace'] !== 'ue' && r.sandboxType !== 'PRIVATE',
    );

    if (filtered.length === 0) {
      res.json({ games: [] });
      return;
    }

    // ── Batch catalog lookups by namespace ────────────────────────────────
    const byNamespace = new Map<string, string[]>();
    for (const r of filtered) {
      const ns = r['@namespace'];
      if (!byNamespace.has(ns)) byNamespace.set(ns, []);
      byNamespace.get(ns)!.push(r.catalogItemId);
    }

    interface CatalogItem {
      id: string;
      title: string;
      categories?: Array<{ path: string }>;
      keyImages?: Array<{ type: string; url: string }>;
    }

    const catalogMap = new Map<string, CatalogItem>();

    await Promise.all(
      Array.from(byNamespace.entries()).map(async ([ns, ids]) => {
        try {
          // Epic API requires a separate id= param per item, not comma-joined.
          const qs = new URLSearchParams();
          ids.forEach(id => qs.append('id', id));
          qs.set('country', 'US');
          qs.set('locale', 'en-US');
          qs.set('includeMainGameDetails', 'true');

          const { data } = await axios.get(
            `${EPIC_CATALOG_BASE}/${ns}/bulk/items?${qs.toString()}`,
            { headers: { Authorization: authHeader }, timeout: UPSTREAM_TIMEOUT_MS },
          );
          for (const [id, item] of Object.entries(data as Record<string, CatalogItem>)) {
            catalogMap.set(id, item);
          }
        } catch (err) {
          // catalog failure is non-fatal; games fall back to appName
          const detail = axios.isAxiosError(err)
            ? `HTTP ${err.response?.status ?? '?'}: ${JSON.stringify(err.response?.data ?? {}).slice(0, 120)}`
            : String(err);
          console.error(`[Epic] catalog lookup failed (ns=${ns}):`, detail);
        }
      }),
    );

    // ── Build final game list, excluding plugins / digital extras / unresolved items ──
    const games = filtered
      .filter(r => {
        const catalog = catalogMap.get(r.catalogItemId);
        // Drop items with no catalog title — they are DLC stubs, engine assets,
        // or internal records whose appName is a raw UUID with no display name.
        if (!catalog?.title) return false;
        const categories = catalog.categories?.map(c => c.path.toLowerCase()) ?? [];
        return !categories.some(c => c.includes('plugins') || c.includes('digitalextras'));
      })
      .map(r => {
        const catalog = catalogMap.get(r.catalogItemId)!;
        const headerImage = catalog.keyImages?.find(
          img => img.type === 'DieselStoreFrontWide' || img.type === 'OfferImageWide',
        )?.url;

        return {
          appId: r.appName,
          name: catalog.title,
          hoursPlayed: 0,
          imageUrl: headerImage,
        };
      });

    res.json({ games });
  } catch (err) {
    forwardError(res, err);
  }
});
