import { IncomingMessage, ServerResponse } from 'http';
import { Me } from '../src/types/stats';
import { config } from './config';
import { currentUser, overlayKey } from './auth';
import { leaderboard, playerStats, recentShows } from './db';
import { isHostId } from './discord';
import { liveInfo } from './show';

// Read-only JSON for the site: who am I, stats, leaderboard. Everything except
// the login itself needs a member session.

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function isApiRequest(url: string): boolean {
  return url.startsWith('/api/') && !url.startsWith('/api/admin/') && !url.startsWith('/api/discord/');
}

export function handleApi(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://local');
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (req.method !== 'GET') return send(res, 405, { error: 'Nur GET' });

  const user = currentUser(req);
  if (parts[0] === 'me') {
    if (!user) return send(res, 200, { user: null });
    const isHost = isHostId(user.id);
    const me: Me = {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      isHost,
      overlayUrl: isHost ? `${config.publicUrl}/overlay?key=${overlayKey()}` : undefined,
    };
    return send(res, 200, { user: me });
  }
  if (!user) return send(res, 401, { error: 'Bitte anmelden' });

  if (parts[0] === 'live') return send(res, 200, liveInfo());
  if (parts[0] === 'leaderboard') return send(res, 200, leaderboard());
  if (parts[0] === 'shows') return send(res, 200, recentShows(Math.min(50, Number(url.searchParams.get('limit')) || 10)));
  if (parts[0] === 'players' && parts[1]) {
    const stats = playerStats(parts[1]);
    return stats ? send(res, 200, stats) : send(res, 404, { error: 'Nicht gefunden' });
  }
  return send(res, 404, { error: 'Unbekannt' });
}
