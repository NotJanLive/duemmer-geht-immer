import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import { Mode } from '../src/types/game';
import { PlayerStats, Tally, emptyTally, LeaderboardRow, ShowSummary } from '../src/types/stats';
import { DATA_DIR } from './pool';

// Users and finished shows, stored as JSON in DATA_DIR next to the pool. The
// whole file is small (a few hundred shows at most), so it lives in memory and
// every stat is computed from the show list.

export interface UserRecord {
  id: string;
  username: string;
  name: string; // server nickname without the [IV] tag, else global name
  avatar: string | null;
  firstSeen: number;
  lastSeen: number;
}

export interface ShowPlayerRecord {
  id: string;
  name: string;
  total: number;
  place: number; // 1 = winner, ties share a place
  modes: Partial<Record<Mode, number>>;
  tally: Tally;
}

export interface ShowRecord {
  id: string;
  hostId: string;
  startedAt: number;
  endedAt: number;
  plan: Mode[];
  players: ShowPlayerRecord[];
  winners: string[];
  awarded: boolean; // winner role and nickname given
}

interface Db {
  version: 1;
  users: Record<string, UserRecord>;
  shows: ShowRecord[];
}

const FILE = path.join(DATA_DIR, 'stats.json');
let db: Db | null = null;

function load(): Db {
  if (db) return db;
  if (existsSync(FILE)) {
    try {
      db = JSON.parse(readFileSync(FILE, 'utf8')) as Db;
    } catch (err) {
      // Never start over silently on a broken file: that would wipe the stats.
      throw new Error(`Could not read ${FILE}: ${err}`);
    }
  } else {
    db = { version: 1, users: {}, shows: [] };
  }
  db.users ??= {};
  db.shows ??= [];
  return db;
}

function save() {
  if (!db) return;
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, FILE);
}

export function upsertUser(user: Omit<UserRecord, 'firstSeen' | 'lastSeen'>): UserRecord {
  const d = load();
  const now = Date.now();
  const old = d.users[user.id];
  const record: UserRecord = { ...user, firstSeen: old?.firstSeen ?? now, lastSeen: now };
  d.users[user.id] = record;
  save();
  return record;
}

export function getUser(id: string): UserRecord | undefined {
  return load().users[id];
}

export function addShow(show: ShowRecord) {
  const d = load();
  d.shows.push(show);
  save();
}

export function markAwarded(showId: string) {
  const show = load().shows.find((s) => s.id === showId);
  if (show) {
    show.awarded = true;
    save();
  }
}

export function getShow(id: string): ShowRecord | undefined {
  return load().shows.find((s) => s.id === id);
}

export function winCount(userId: string): number {
  return load().shows.filter((s) => s.winners.includes(userId)).length;
}

// Everyone who won the show before this one (they lose the winner role).
export function previousWinners(beforeShowId: string): string[] {
  const shows = load().shows;
  const i = shows.findIndex((s) => s.id === beforeShowId);
  const prev = i > 0 ? shows[i - 1] : undefined;
  return prev?.winners ?? [];
}

function addTally(a: Tally, b: Tally): Tally {
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof Tally)[]) out[k] = (out[k] ?? 0) + (b[k] ?? 0);
  return out;
}

function displayName(id: string, fallback: string) {
  return load().users[id]?.name ?? fallback;
}

export function playerStats(id: string): PlayerStats | null {
  const d = load();
  const user = d.users[id];
  const played = d.shows.filter((s) => s.players.some((p) => p.id === id));
  if (!user && played.length === 0) return null;

  let tally = emptyTally();
  const modePoints: Partial<Record<Mode, { total: number; shows: number }>> = {};
  let points = 0;
  let best = 0;
  let placeSum = 0;
  const places: Record<number, number> = {};
  const history: PlayerStats['history'] = [];

  for (const show of played) {
    const me = show.players.find((p) => p.id === id)!;
    tally = addTally(tally, me.tally);
    points += me.total;
    best = Math.max(best, me.total);
    placeSum += me.place;
    places[me.place] = (places[me.place] ?? 0) + 1;
    for (const [mode, value] of Object.entries(me.modes) as [Mode, number][]) {
      const m = (modePoints[mode] ??= { total: 0, shows: 0 });
      m.total += value;
      m.shows++;
    }
    history.push({ showId: show.id, endedAt: show.endedAt, place: me.place, total: me.total, players: show.players.length });
  }

  return {
    id,
    name: user?.name ?? played.at(-1)?.players.find((p) => p.id === id)?.name ?? 'Unbekannt',
    avatar: user?.avatar ?? null,
    shows: played.length,
    wins: played.filter((s) => s.winners.includes(id)).length,
    podiums: played.filter((s) => (s.players.find((p) => p.id === id)?.place ?? 99) <= 3).length,
    points,
    bestTotal: best,
    avgPlace: played.length ? placeSum / played.length : 0,
    places,
    modes: modePoints,
    tally,
    history: history.reverse().slice(0, 20),
  };
}

export function leaderboard(): LeaderboardRow[] {
  const d = load();
  const ids = new Set(d.shows.flatMap((s) => s.players.map((p) => p.id)));
  const rows = [...ids].map((id) => {
    const s = playerStats(id)!;
    return {
      id,
      name: s.name,
      avatar: s.avatar,
      shows: s.shows,
      wins: s.wins,
      podiums: s.podiums,
      points: s.points,
      avgPoints: s.shows ? s.points / s.shows : 0,
      avgPlace: s.avgPlace,
    };
  });
  return rows.sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.avgPoints - a.avgPoints || a.name.localeCompare(b.name, 'de'));
}

export function recentShows(limit = 10): ShowSummary[] {
  return load()
    .shows.slice(-limit)
    .reverse()
    .map((s) => ({
      id: s.id,
      endedAt: s.endedAt,
      plan: s.plan,
      players: [...s.players]
        .sort((a, b) => a.place - b.place)
        .map((p) => ({ id: p.id, name: displayName(p.id, p.name), total: p.total, place: p.place, modes: p.modes })),
    }));
}
