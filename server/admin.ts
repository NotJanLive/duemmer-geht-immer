import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { POOL_MODES, PoolContent, PoolMode } from '../src/types/pool';
import { saveImage } from './media';
import { addEntries, getPool, isPoolMode, removeEntries, resetPlayed, savePool, updateEntry, updateSettings, validate } from './pool';

// JSON API for /admin. Only the person with ADMIN_PASSWORD gets in. Without
// the variable the admin area is switched off.

const COOKIE = 'dgi_admin';
const SESSION_TTL = 12 * 60 * 60 * 1000;
const MAX_BODY = 5 * 1024 * 1024;

const sessions = new Map<string, number>(); // token -> expires at

const hash = (v: string) => createHash('sha256').update(v).digest();

function passwordMatches(input: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== 'string') return false;
  return timingSafeEqual(hash(input), hash(expected));
}

function tokenFrom(req: IncomingMessage): string | null {
  const match = (req.headers.cookie ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`));
  return match?.[1] ?? null;
}

function isLoggedIn(req: IncomingMessage): boolean {
  const token = tokenFrom(req);
  const expires = token ? sessions.get(token) : undefined;
  if (!token || !expires) return false;
  if (expires < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('bad json'));
      }
    });
    req.on('error', reject);
  });
}

// Checks every entry first and only adds when all are fine.
function checkEntries(mode: PoolMode, raw: unknown[]) {
  const errors: string[] = [];
  const valid: PoolContent[PoolMode][] = [];
  raw.forEach((item, i) => {
    const result = validate(mode, item);
    if (result.ok) valid.push(result.value);
    else errors.push(`#${i + 1}: ${result.error}`);
  });
  return { errors, valid };
}

export function isAdminRequest(url: string): boolean {
  return url.startsWith('/api/admin/');
}

export async function handleAdmin(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://local');
  const parts = url.pathname.replace(/^\/api\/admin\/?/, '').split('/').filter(Boolean);
  const method = req.method ?? 'GET';

  // POST /images: raw image body. A browser only sends an image content type
  // cross-site after a CORS preflight, which this server never allows.
  if (parts[0] === 'images' && method === 'POST') {
    if (!isLoggedIn(req)) return send(res, 401, { error: 'Bitte anmelden' });
    const result = await saveImage(req);
    return 'error' in result ? send(res, 400, result) : send(res, 201, result);
  }

  // Only JSON for writes, so a plain cross-site form can never post here.
  if (method !== 'GET' && !(req.headers['content-type'] ?? '').startsWith('application/json')) {
    return send(res, 415, { error: 'JSON erwartet' });
  }

  let body: unknown = {};
  if (method !== 'GET') {
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { error: 'Ungültige Anfrage' });
    }
  }
  const data = (body ?? {}) as Record<string, unknown>;

  if (parts[0] === 'login' && method === 'POST') {
    if (!process.env.ADMIN_PASSWORD) return send(res, 503, { error: 'Der Adminbereich ist nicht eingerichtet (ADMIN_PASSWORD fehlt)' });
    if (!passwordMatches(data.password)) {
      await new Promise((r) => setTimeout(r, 1000));
      return send(res, 401, { error: 'Falsches Passwort' });
    }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL);
    return send(res, 200, { ok: true }, {
      'Set-Cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`,
    });
  }

  if (parts[0] === 'logout' && method === 'POST') {
    const token = tokenFrom(req);
    if (token) sessions.delete(token);
    return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
  }

  if (!isLoggedIn(req)) return send(res, 401, { error: 'Bitte anmelden' });

  // GET /pool: everything the admin page shows
  if (parts[0] === 'pool' && method === 'GET') return send(res, 200, getPool());

  // GET /export: the whole pool as a download
  if (parts[0] === 'export' && method === 'GET') {
    const date = new Date().toISOString().slice(0, 10);
    return send(res, 200, getPool(), { 'Content-Disposition': `attachment; filename="pool-${date}.json"` });
  }

  if (parts[0] === 'settings' && method === 'PUT') {
    const result = updateSettings(data);
    return result.ok ? send(res, 200, result.value) : send(res, 400, { error: result.error });
  }

  // POST /import  { mode, entries: [...] }  or a full export { entries: { mode: [...] } }
  // replace: true swaps the mode's pool instead of adding to it.
  if (parts[0] === 'import' && method === 'POST') {
    const replace = data.replace === true;
    const batches: [PoolMode, unknown[]][] = [];
    if (isPoolMode(data.mode) && Array.isArray(data.entries)) batches.push([data.mode, data.entries]);
    else if (data.entries && typeof data.entries === 'object') {
      for (const mode of POOL_MODES) {
        const list = (data.entries as Record<string, unknown>)[mode];
        if (Array.isArray(list)) batches.push([mode, list]);
      }
    }
    if (batches.length === 0) return send(res, 400, { error: 'Keine Einträge gefunden. Erwartet wird { "mode": ..., "entries": [...] } oder ein Export.' });

    const checked = batches.map(([mode, list]) => ({ mode, ...checkEntries(mode, list) }));
    const errors = checked.flatMap((c) => c.errors.map((e) => `${c.mode} ${e}`));
    if (errors.length) return send(res, 400, { error: 'Import abgebrochen, nichts wurde geändert', details: errors.slice(0, 50) });

    const pool = getPool();
    const added: Record<string, number> = {};
    for (const c of checked) {
      if (replace) pool.entries[c.mode] = [] as never;
      added[c.mode] = addEntries(c.mode, c.valid).length;
    }
    savePool();
    return send(res, 200, { ok: true, added });
  }

  // /entries/:mode and /entries/:mode/:id
  if (parts[0] === 'entries' && isPoolMode(parts[1])) {
    const mode = parts[1];
    const id = parts[2];

    if (!id && method === 'POST') {
      const result = validate(mode, data);
      if (!result.ok) return send(res, 400, { error: result.error });
      return send(res, 201, addEntries(mode, [result.value])[0]);
    }
    if (id && method === 'PUT') {
      const result = validate(mode, data);
      if (!result.ok) return send(res, 400, { error: result.error });
      const entry = updateEntry(mode, id, result.value);
      return entry ? send(res, 200, entry) : send(res, 404, { error: 'Nicht gefunden' });
    }
    if (id && method === 'DELETE') {
      return removeEntries(mode, [id]) ? send(res, 200, { ok: true }) : send(res, 404, { error: 'Nicht gefunden' });
    }
  }

  // POST /reset/:mode  { ids?: [...] } sets play stats back to "never played"
  if (parts[0] === 'reset' && isPoolMode(parts[1]) && method === 'POST') {
    const ids = Array.isArray(data.ids) ? data.ids.filter((i): i is string => typeof i === 'string') : undefined;
    resetPlayed(parts[1], ids);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: 'Unbekannte Anfrage' });
}
