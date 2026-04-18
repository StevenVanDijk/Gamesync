/**
 * Azure Blob Storage CSV game-list proxy routes.
 *
 * The client supplies a pre-signed SAS URL.  The backend fetches the CSV,
 * parses it, and returns a normalised game list.  No secrets live server-side.
 *
 * CSV format (header row required):
 *   name,source,playtime
 *   Team Fortress 2,steam,120.5
 *   The Witcher 3,gog,34
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

export const blobRouter = Router();

const UPSTREAM_TIMEOUT_MS = 15_000;

function forwardError(res: Response, err: unknown): void {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const status = err.response.status;
      const detail =
        typeof err.response.data === 'string'
          ? err.response.data.slice(0, 200)
          : JSON.stringify(err.response.data ?? {});
      console.error(`[Blob] upstream HTTP ${status}:`, detail);
      res.status(status).json({ error: err.response.statusText, detail });
    } else if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
      res.status(504).json({ error: 'Upstream request timed out' });
    } else {
      res.status(502).json({ error: 'Upstream request failed', detail: err.message });
    }
  } else {
    console.error('[Blob] unexpected error:', err);
    res.status(502).json({ error: 'Upstream request failed', detail: String(err) });
  }
}

/**
 * Parse a CSV string into an array of row objects.
 * Handles quoted fields (RFC 4180 subset), comma and semicolon separators.
 */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length < 2) return [];

  // Auto-detect delimiter from header row
  const header = nonEmpty[0];
  const delimiter = header.includes(';') ? ';' : ',';

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === delimiter && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseRow(header).map(h => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseRow(nonEmpty[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

/**
 * GET /api/blob/library?url=<sas-url>
 * Fetches the CSV at the given URL and returns parsed games.
 */
blobRouter.get('/library', async (req: Request, res: Response) => {
  const url = req.query['url'] as string | undefined;

  if (!url?.trim()) {
    res.status(400).json({ error: 'url query param is required' });
    return;
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch {
    res.status(400).json({ error: 'url is not valid URI-encoded' });
    return;
  }

  try {
    const { data } = await axios.get<string>(decodedUrl, {
      responseType: 'text',
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    const rows = parseCsv(data);

    const games = rows
      .filter(r => r['name']?.trim())
      .map(r => {
        const rawPlaytime = r['playtime'] ?? r['hours'] ?? r['hours played'] ?? '0';
        const hoursPlayed = Math.max(0, parseFloat(rawPlaytime) || 0);
        return {
          name: r['name'].trim(),
          source: (r['source'] ?? r['store'] ?? '').toLowerCase().trim(),
          hoursPlayed,
        };
      });

    res.json({ games });
  } catch (err) {
    forwardError(res, err);
  }
});
