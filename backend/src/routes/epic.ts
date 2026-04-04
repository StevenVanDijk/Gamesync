/**
 * Epic Games API proxy routes.
 *
 * Environment variables required:
 *   EPIC_CLIENT_ID      – OAuth client ID from dev.epicgames.com
 *   EPIC_CLIENT_SECRET  – OAuth client secret
 *   EPIC_REDIRECT_URI   – Must match the registered redirect URI, e.g.
 *                         https://your-app.vercel.app/epic-callback
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

export const epicRouter = Router();

const EPIC_TOKEN_URL = 'https://api.epicgames.dev/epic/oauth/v1/token';
const EPIC_ENTITLEMENTS_BASE = 'https://api.epicgames.dev/epic/ecom/v1/identities';
const EPIC_CATALOG_URL = 'https://api.epicgames.dev/epic/ecom/v1/catalog/items';
const EPIC_AUTH_BASE = 'https://www.epicgames.com/id/api/redirect';

const UPSTREAM_TIMEOUT_MS = 8_000;

function forwardError(res: Response, err: unknown): void {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const status = err.response.status;
      const detail = typeof err.response.data === 'string'
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

function getClientCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env['EPIC_CLIENT_ID'];
  const clientSecret = process.env['EPIC_CLIENT_SECRET'];
  const redirectUri = process.env['EPIC_REDIRECT_URI'];
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('EPIC_CLIENT_ID, EPIC_CLIENT_SECRET, and EPIC_REDIRECT_URI must be set');
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * GET /api/epic/auth-url
 * Returns the Epic authorization URL the client should redirect the user to.
 */
epicRouter.get('/auth-url', (_req: Request, res: Response) => {
  try {
    const { clientId, redirectUri } = getClientCredentials();
    const url = `${EPIC_AUTH_BASE}?clientId=${encodeURIComponent(clientId)}&redirectUri=${encodeURIComponent(redirectUri)}&responseType=code`;
    res.json({ url });
  } catch (err) {
    res.status(503).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/epic/token
 * Exchanges an authorization code for tokens.
 * Body: { code: string }
 */
epicRouter.post('/token', async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ error: 'code is required' });
    return;
  }
  try {
    const { clientId, clientSecret, redirectUri } = getClientCredentials();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const { data } = await axios.post(EPIC_TOKEN_URL, params.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    // Return only what the frontend needs
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
    const { clientId, clientSecret } = getClientCredentials();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const { data } = await axios.post(EPIC_TOKEN_URL, params.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
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
  const { accountId } = req.params;
  const { accessToken } = req.query as { accessToken?: string };

  if (!accessToken) {
    res.status(400).json({ error: 'accessToken query param is required' });
    return;
  }

  try {
    const { data } = await axios.get(`${EPIC_ENTITLEMENTS_BASE}/${accountId}/entitlements`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { start: 0, count: 1000, entitlementType: 'EXECUTABLE' },
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    interface Entitlement {
      id: string;
      entitlementName: string;
      namespace: string;
      catalogItemId: string;
      status: string;
      active: boolean;
    }

    const elements: Entitlement[] = (data as { elements: Entitlement[] }).elements ?? [];
    const active = elements.filter(e => e.active && e.status === 'ACTIVE');

    if (active.length === 0) {
      res.json({ games: [] });
      return;
    }

    // Batch catalog lookups by namespace
    const byNamespace = new Map<string, string[]>();
    for (const e of active) {
      if (!byNamespace.has(e.namespace)) byNamespace.set(e.namespace, []);
      byNamespace.get(e.namespace)!.push(e.catalogItemId);
    }

    interface CatalogItem {
      id: string;
      title: string;
      keyImages?: Array<{ type: string; url: string }>;
    }

    const catalogMap = new Map<string, CatalogItem>();

    await Promise.all(
      Array.from(byNamespace.entries()).map(async ([ns, ids]) => {
        try {
          const { data: catalog } = await axios.get(EPIC_CATALOG_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { namespace: ns, id: ids.join(','), country: 'US', locale: 'en-US' },
          });
          for (const [id, item] of Object.entries(catalog as Record<string, CatalogItem>)) {
            catalogMap.set(id, item);
          }
        } catch {
          // catalog lookup failure is non-fatal; games fall back to entitlementName
        }
      }),
    );

    const games = active.map(e => {
      const catalogItem = catalogMap.get(e.catalogItemId);
      const headerImage = catalogItem?.keyImages?.find(
        img => img.type === 'DieselStoreFrontWide' || img.type === 'OfferImageWide',
      )?.url;

      return {
        appId: e.catalogItemId,
        name: catalogItem?.title ?? e.entitlementName,
        hoursPlayed: 0,
        imageUrl: headerImage,
      };
    });

    res.json({ games });
  } catch (err) {
    forwardError(res, err);
  }
});
