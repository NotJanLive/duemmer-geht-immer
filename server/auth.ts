import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { config, secureCookies } from './config';
import { UserRecord, getUser, upsertUser } from './db';
import { authorizeUrl, avatarUrl, isHostId, memberFromCode, memberName } from './discord';

// Login with Discord. The session is a signed cookie with the user id, so a
// restart or deploy does not log anyone out.

const COOKIE = 'dgi_user';
const STATE_COOKIE = 'dgi_oauth';
const SESSION_DAYS = 60;

function sign(value: string): string {
  return createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

export function derive(purpose: string, length = 20): string {
  return createHmac('sha256', config.sessionSecret).update(purpose).digest('hex').slice(0, length);
}

export function camId(userId: string): string {
  return `dgi${derive(`cam:${userId}`, 16)}`;
}

export function overlayKey(): string {
  return derive('overlay', 24);
}

function readCookie(header: string | undefined, name: string): string | null {
  const match = (header ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;
}

export function userIdFromCookie(header: string | undefined): string | null {
  if (!config.sessionSecret) return null;
  const raw = readCookie(header, COOKIE);
  if (!raw) return null;
  const [payload, mac] = raw.split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { id, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { id: string; exp: number };
    return exp > Date.now() && typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

export function currentUser(req: IncomingMessage): UserRecord | null {
  const id = userIdFromCookie(req.headers.cookie);
  return id ? (getUser(id) ?? null) : null;
}

export function isHostRequest(req: IncomingMessage): boolean {
  const user = currentUser(req);
  return !!user && isHostId(user.id);
}

function sessionCookie(id: string): string {
  const payload = Buffer.from(JSON.stringify({ id, exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url');
  return cookie(COOKIE, `${payload}.${sign(payload)}`, SESSION_DAYS * 86400);
}

function redirect(res: ServerResponse, to: string, cookies: string[] = []) {
  res.writeHead(302, { Location: to, 'Cache-Control': 'no-store', ...(cookies.length ? { 'Set-Cookie': cookies } : {}) });
  res.end();
}

export function isAuthRequest(url: string): boolean {
  return url.startsWith('/auth/');
}

export async function handleAuth(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://local');

  if (url.pathname === '/auth/logout') return redirect(res, '/', [cookie(COOKIE, '', 0)]);

  if (!config.sessionSecret || !config.clientId) return redirect(res, '/?error=setup');

  if (url.pathname === '/auth/login') {
    const state = randomBytes(16).toString('hex');
    return redirect(res, authorizeUrl(state), [cookie(STATE_COOKIE, state, 600)]);
  }

  if (url.pathname === '/auth/callback') {
    const state = readCookie(req.headers.cookie, STATE_COOKIE);
    const clearState = cookie(STATE_COOKIE, '', 0);
    const code = url.searchParams.get('code');
    if (!code || !state || url.searchParams.get('state') !== state) return redirect(res, '/?error=state', [clearState]);
    try {
      const member = await memberFromCode(code);
      if (!member) return redirect(res, '/?error=member', [clearState]);
      upsertUser({
        id: member.user.id,
        username: member.user.username,
        name: memberName(member),
        avatar: avatarUrl(member.user.id, member.user.avatar, member.avatar),
      });
      return redirect(res, '/', [clearState, sessionCookie(member.user.id)]);
    } catch (err) {
      console.error('Login failed:', err);
      return redirect(res, '/?error=login', [clearState]);
    }
  }

  // Test logins for the local test scripts, only with DEV_LOGIN=on.
  if (url.pathname === '/auth/dev' && config.devLogin) {
    const id = url.searchParams.get('id') ?? '';
    const name = url.searchParams.get('name') ?? id;
    if (!/^\d{1,20}$/.test(id)) return redirect(res, '/?error=login');
    upsertUser({ id, username: name, name, avatar: null });
    const to = url.searchParams.get('to') ?? '/';
    return redirect(res, /^\/(?!\/)/.test(to) ? to : '/', [sessionCookie(id)]);
  }

  res.writeHead(404).end();
}
