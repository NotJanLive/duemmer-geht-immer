import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import {
  DEFAULT_SETTINGS,
  GeoContent,
  MAPS,
  MEDIA_PATTERN,
  MapId,
  PICTURE_KINDS,
  PicContent,
  PictureKind,
  HolContent,
  JeoContent,
  LmsContent,
  POOL_MODES,
  PoolContent,
  PoolData,
  PoolEntry,
  PoolMeta,
  PoolMode,
  PoolSettings,
  WWM_MAX_POINTS,
  WWM_PER_LEVEL,
  WwmContent,
  ITUNES_COVER,
  ITUNES_PREVIEW,
  SONG_PREVIEW_SECONDS,
  SongContent,
  SongItem,
} from '../src/types/pool';
import { geoData, higherLowerData, jeopardyData, lmsData, millionaireData, songData } from './seedData';

// The pool lives outside the repo (the repo is public) in DATA_DIR. In
// production that is its own Docker volume, because the deploy wipes the app
// volume on every push.
export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
const POOL_FILE = path.join(DATA_DIR, 'pool.json');

let pool: PoolData | null = null;

function seed(): PoolData {
  const now = Date.now();
  const meta = () => ({ id: randomUUID(), createdAt: now, playCount: 0, lastPlayedAt: null });
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    entries: {
      lastManStanding: lmsData.map((r) => ({ ...meta(), topic: r.topic, items: r.items })),
      millionaire: millionaireData.map((q, i) => ({
        ...meta(),
        question: q.q,
        options: q.o,
        answer: q.a,
        points: Math.floor(i / 2) + 1,
      })),
      higherLower: higherLowerData.map((r) => ({ ...meta(), topic: r.topic, unit: r.unit, items: r.items })),
      geo: geoData.map((c) => ({ ...meta(), ...c })),
      pictures: [],
      songs: songData.map((c) => ({ ...meta(), name: c.name, songs: c.songs.map((s) => ({ ...s })) })),
      jeopardy: jeopardyData.map((c) => ({
        ...meta(),
        name: c.name,
        questions: c.questions.map((q) => ({ question: q.q, answer: q.a })),
      })),
    },
  };
}

export function getPool(): PoolData {
  if (pool) return pool;
  if (existsSync(POOL_FILE)) {
    pool = JSON.parse(readFileSync(POOL_FILE, 'utf8')) as PoolData;
    pool.settings = { ...DEFAULT_SETTINGS, ...pool.settings };
    const old = pool.settings as PoolSettings & Record<string, unknown>;
    for (const key of ['wwmQuestions', 'wwmPoints', 'wwmMaxPoints', 'wwmPerLevel', 'picStart', 'picFloor', 'picStepSeconds']) delete old[key];
    // Questions from before points per question: they were stored in the old
    // order (2 per level), so their position gives the points.
    pool.entries.millionaire.forEach((q, i) => {
      const legacy = q as typeof q & { difficulty?: number };
      if (typeof legacy.points !== 'number') legacy.points = Math.floor(i / 2) + 1;
      delete legacy.difficulty;
    });
    for (const e of [...pool.entries.lastManStanding, ...pool.entries.higherLower]) delete (e as typeof e & { difficulty?: number }).difficulty;
    // Geo categories from older scorings (scale, maxKm, radius, halfKm) get the defaults.
    for (const c of pool.entries.geo ?? []) {
      const old = c as typeof c & { scale?: number; maxKm?: number; radius?: number; halfKm?: number };
      if (old.minKm === undefined) old.minKm = MAPS[c.map].minKm;
      delete old.scale;
      delete old.maxKm;
      delete old.radius;
      delete old.halfKm;
    }
    for (const c of pool.entries.pictures ?? []) if (!PICTURE_KINDS[c.kind]) c.kind = 'pixel';
    // A mode added after the pool was created starts with its seed content.
    for (const mode of POOL_MODES) pool.entries[mode] ??= seed().entries[mode] as never;
    savePool();
  } else {
    pool = seed();
    savePool();
  }
  return pool;
}

// Write to a temp file and rename, so a crash never leaves half a pool.
export function savePool() {
  if (!pool) return;
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${POOL_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(pool, null, 2));
  renameSync(tmp, POOL_FILE);
}

export function poolCounts(): Record<PoolMode, number> {
  const { entries } = getPool();
  return Object.fromEntries(POOL_MODES.map((m) => [m, entries[m].length])) as Record<PoolMode, number>;
}

// Picking. Never played entries come first in random order, then the ones that
// were played longest ago. Picked entries are marked as played right away.

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function freshestFirst<T extends { lastPlayedAt: number | null }>(items: T[]): T[] {
  return shuffle(items).sort((a, b) => (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0));
}

function markPlayed(items: { playCount: number; lastPlayedAt: number | null }[]) {
  const now = Date.now();
  for (const item of items) {
    item.playCount++;
    item.lastPlayedAt = now;
  }
  savePool();
}

// Topics for LMS and HoL: the freshest ones, in random order.
export function pickTopics<M extends 'lastManStanding' | 'higherLower'>(mode: M, count: number): PoolEntry<M>[] {
  const entries = getPool().entries[mode] as PoolEntry<M>[];
  const picked = freshestFirst(entries).slice(0, count);
  markPlayed(picked);
  return picked;
}

// Millionaire: WWM_PER_LEVEL questions for every points level from 1 to
// WWM_MAX_POINTS, in that order. A slot is worth its level. Every level first
// takes its own questions. Only slots still empty then take the closest
// leftover question (lower first), so a show can run with gaps in the pool.
export function pickMillionaire(): { entry: PoolEntry<'millionaire'>; points: number }[] {
  const left = freshestFirst(getPool().entries.millionaire);
  const slots: { entry: PoolEntry<'millionaire'> | null; points: number }[] = [];
  for (let level = 1; level <= WWM_MAX_POINTS; level++) {
    for (let n = 0; n < WWM_PER_LEVEL; n++) {
      const at = left.findIndex((q) => q.points === level);
      slots.push({ entry: at === -1 ? null : left.splice(at, 1)[0], points: level });
    }
  }
  const distance = (q: PoolEntry<'millionaire'>, level: number) => Math.abs(q.points - level) + (q.points > level ? 0.5 : 0);
  for (const slot of slots) {
    if (slot.entry || !left.length) continue;
    const best = left.reduce((a, b) => (distance(b, slot.points) < distance(a, slot.points) ? b : a));
    slot.entry = left.splice(left.indexOf(best), 1)[0];
  }
  const filled = slots.filter((s): s is { entry: PoolEntry<'millionaire'>; points: number } => s.entry !== null);
  markPlayed(filled.map((s) => s.entry));
  return filled;
}

// Wo liegt das?: the freshest category, `rounds` of its places in random order.
export function pickGeo(rounds: number): { category: PoolEntry<'geo'>; places: GeoContent['places'] } | null {
  const category = freshestFirst(getPool().entries.geo)[0];
  if (!category) return null;
  markPlayed([category]);
  return { category, places: shuffle(category.places).slice(0, rounds) };
}

// Bildrätsel: the freshest categories, each with `perRound` random pictures.
export function pickPictures(rounds: number, perRound: number): { category: PoolEntry<'pictures'>; items: PicContent['items'] }[] {
  const picked = freshestFirst(getPool().entries.pictures).slice(0, rounds);
  markPlayed(picked);
  return picked.map((category) => ({ category, items: shuffle(category.items).slice(0, perRound) }));
}

// Songrätsel: the freshest categories, each with `perRound` random songs.
export function pickSongs(rounds: number, perRound: number): { category: PoolEntry<'songs'>; songs: SongItem[] }[] {
  const picked = freshestFirst(getPool().entries.songs).slice(0, rounds);
  markPlayed(picked);
  return picked.map((category) => ({ category, songs: shuffle(category.songs).slice(0, perRound) }));
}

export function pickJeopardy(count: number): PoolEntry<'jeopardy'>[] {
  const picked = freshestFirst(getPool().entries.jeopardy).slice(0, count);
  markPlayed(picked);
  return picked;
}

// Validation of admin input. Returns clean content or an error message.

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const text = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function validateLms(raw: Record<string, unknown>): Result<LmsContent> {
  const topic = text(raw.topic);
  const items = Array.isArray(raw.items) ? raw.items.map((i) => text(i, 100)).filter(Boolean) : [];
  if (!topic) return { ok: false, error: 'Thema fehlt' };
  if (items.length < 2) return { ok: false, error: `"${topic}": mindestens 2 Begriffe` };
  if (new Set(items.map((i) => i.toLowerCase())).size !== items.length) return { ok: false, error: `"${topic}": Begriffe doppelt` };
  return { ok: true, value: { topic, items } };
}

function validateWwm(raw: Record<string, unknown>): Result<WwmContent> {
  const question = text(raw.question, 500);
  const options = Array.isArray(raw.options) ? raw.options.map((o) => text(o, 200)) : [];
  const points = raw.points;
  if (!question) return { ok: false, error: 'Frage fehlt' };
  if (options.length !== 4 || options.some((o) => !o)) return { ok: false, error: `"${question}": genau 4 Antworten nötig` };
  if (!Number.isInteger(raw.answer) || (raw.answer as number) < 0 || (raw.answer as number) > 3) {
    return { ok: false, error: `"${question}": richtige Antwort muss 0 bis 3 sein` };
  }
  if (!Number.isInteger(points) || (points as number) < 1 || (points as number) > WWM_MAX_POINTS) {
    return { ok: false, error: `"${question}": Punkte müssen eine ganze Zahl von 1 bis ${WWM_MAX_POINTS} sein` };
  }
  return { ok: true, value: { question, options, answer: raw.answer as number, points: points as number } };
}

function validateHol(raw: Record<string, unknown>): Result<HolContent> {
  const topic = text(raw.topic);
  const unit = text(raw.unit, 60);
  const items = Array.isArray(raw.items)
    ? raw.items.map((i) => ({ label: text((i as Record<string, unknown>)?.label, 100), value: Number((i as Record<string, unknown>)?.value) }))
    : [];
  if (!topic) return { ok: false, error: 'Thema fehlt' };
  if (items.length < 3) return { ok: false, error: `"${topic}": mindestens 3 Begriffe` };
  if (items.some((i) => !i.label || !Number.isFinite(i.value))) return { ok: false, error: `"${topic}": jeder Begriff braucht Name und Zahl` };
  return { ok: true, value: { topic, unit, items } };
}

function validateJeo(raw: Record<string, unknown>): Result<JeoContent> {
  const name = text(raw.name, 60);
  const questions = Array.isArray(raw.questions)
    ? raw.questions.map((q) => ({ question: text((q as Record<string, unknown>)?.question, 500), answer: text((q as Record<string, unknown>)?.answer, 300) }))
    : [];
  if (!name) return { ok: false, error: 'Kategoriename fehlt' };
  if (questions.length < 1 || questions.length > 10) return { ok: false, error: `"${name}": 1 bis 10 Fragen` };
  if (questions.some((q) => !q.question || !q.answer)) return { ok: false, error: `"${name}": jede Frage braucht Frage und Antwort` };
  return { ok: true, value: { name, questions } };
}

function image(v: unknown): string | null {
  return typeof v === 'string' && MEDIA_PATTERN.test(v) ? v : null;
}

function validateGeo(raw: Record<string, unknown>): Result<GeoContent> {
  const name = text(raw.name, 60);
  const map = raw.map as MapId;
  if (!name) return { ok: false, error: 'Kategoriename fehlt' };
  if (!MAPS[map]) return { ok: false, error: `"${name}": Karte muss ${Object.keys(MAPS).join(', ')} sein` };
  const minKm = Number(raw.minKm ?? MAPS[map].minKm);
  if (!Number.isFinite(minKm) || minKm < 1 || minKm > 20000) return { ok: false, error: `"${name}": "1 Punkt ab" muss zwischen 1 und 20000 km liegen` };
  const places: GeoContent['places'] = [];
  for (const [i, p] of (Array.isArray(raw.places) ? raw.places : []).entries()) {
    const place = (p ?? {}) as Record<string, unknown>;
    const placeName = text(place.name, 100);
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    if (!placeName) return { ok: false, error: `"${name}": Ort ${i + 1} hat keinen Namen` };
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { ok: false, error: `"${name}": "${placeName}" hat keine gültige Position` };
    }
    if (place.image !== undefined && place.image !== '' && !image(place.image)) return { ok: false, error: `"${name}": "${placeName}" hat ein ungültiges Bild` };
    places.push({ name: placeName, lat, lng, ...(image(place.image) ? { image: place.image as string } : {}) });
  }
  if (places.length < 1 || places.length > 300) return { ok: false, error: `"${name}": 1 bis 300 Orte` };
  return { ok: true, value: { name, map, minKm: Math.round(minKm), places } };
}

function validatePictures(raw: Record<string, unknown>): Result<PicContent> {
  const name = text(raw.name, 60);
  const kind = raw.kind as PictureKind;
  if (!name) return { ok: false, error: 'Kategoriename fehlt' };
  if (!PICTURE_KINDS[kind]) return { ok: false, error: `"${name}": Art muss ${Object.keys(PICTURE_KINDS).join(', ')} sein` };
  const items = (Array.isArray(raw.items) ? raw.items : []).map((i) => ({
    image: image((i as Record<string, unknown>)?.image),
    answer: text((i as Record<string, unknown>)?.answer, 200),
  }));
  if (items.length < 1 || items.length > 100) return { ok: false, error: `"${name}": 1 bis 100 Bilder` };
  if (items.some((i) => !i.image || !i.answer)) return { ok: false, error: `"${name}": jedes Bild braucht ein hochgeladenes Bild und eine Lösung` };
  return { ok: true, value: { name, kind, items: items as PicContent['items'] } };
}

function validateSongs(raw: Record<string, unknown>): Result<SongContent> {
  const name = text(raw.name, 60);
  if (!name) return { ok: false, error: 'Kategoriename fehlt' };
  const songs: SongItem[] = [];
  for (const [i, s] of (Array.isArray(raw.songs) ? raw.songs : []).entries()) {
    const song = (s ?? {}) as Record<string, unknown>;
    const trackId = Number(song.trackId);
    const title = text(song.title, 200);
    const artist = text(song.artist, 200);
    const preview = typeof song.preview === 'string' ? song.preview : '';
    const cover = typeof song.cover === 'string' && ITUNES_COVER.test(song.cover) ? song.cover : '';
    const offset = Math.max(0, Math.min(SONG_PREVIEW_SECONDS - 5, Number(song.offset) || 0));
    if (!Number.isInteger(trackId) || trackId <= 0 || !title || !artist) return { ok: false, error: `"${name}": Song ${i + 1} ist unvollständig` };
    if (!ITUNES_PREVIEW.test(preview)) return { ok: false, error: `"${name}": "${title}" hat keine gültige Hörprobe` };
    songs.push({ trackId, title, artist, cover, preview, offset: Math.round(offset * 10) / 10 });
  }
  if (songs.length < 1 || songs.length > 200) return { ok: false, error: `"${name}": 1 bis 200 Songs` };
  return { ok: true, value: { name, songs } };
}

const validators: { [M in PoolMode]: (raw: Record<string, unknown>) => Result<PoolContent[M]> } = {
  lastManStanding: validateLms,
  millionaire: validateWwm,
  higherLower: validateHol,
  geo: validateGeo,
  pictures: validatePictures,
  songs: validateSongs,
  jeopardy: validateJeo,
};

export function isPoolMode(v: unknown): v is PoolMode {
  return POOL_MODES.includes(v as PoolMode);
}

export function validate<M extends PoolMode>(mode: M, raw: unknown): Result<PoolContent[M]> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Ungültiger Eintrag' };
  return validators[mode](raw as Record<string, unknown>) as Result<PoolContent[M]>;
}

// Admin edits

export function addEntries<M extends PoolMode>(mode: M, contents: PoolContent[M][]): PoolEntry<M>[] {
  const now = Date.now();
  const added = contents.map((c) => ({ ...c, id: randomUUID(), createdAt: now, playCount: 0, lastPlayedAt: null }) as PoolEntry<M>);
  (getPool().entries[mode] as PoolEntry<M>[]).push(...added);
  savePool();
  return added;
}

export function updateEntry<M extends PoolMode>(mode: M, id: string, content: PoolContent[M]): PoolEntry<M> | null {
  const list = getPool().entries[mode] as PoolEntry<M>[];
  const at = list.findIndex((e) => e.id === id);
  if (at === -1) return null;
  const { createdAt, playCount, lastPlayedAt } = list[at];
  list[at] = { ...content, id, createdAt, playCount, lastPlayedAt } as PoolEntry<M>;
  savePool();
  return list[at];
}

export function removeEntries(mode: PoolMode, ids: string[]): number {
  const p = getPool();
  const before: PoolMeta[] = p.entries[mode];
  const after = before.filter((e) => !ids.includes(e.id));
  p.entries[mode] = after as never;
  savePool();
  return before.length - after.length;
}

export function resetPlayed(mode: PoolMode, ids?: string[]) {
  for (const e of getPool().entries[mode] as PoolMeta[]) {
    if (ids && !ids.includes(e.id)) continue;
    e.playCount = 0;
    e.lastPlayedAt = null;
  }
  savePool();
}

const NUMBER_LIMITS = {
  lmsRounds: [1, 20],
  lmsPointsPerPlace: [1, 100],
  holRounds: [1, 20],
  holPoints: [1, 500],
  geoRounds: [1, 50],
  geoSeconds: [5, 300],
  picRounds: [1, 20],
  picPerRound: [1, 30],
  geoMaxPoints: [1, 500],
  picRevealSeconds: [5, 600],
  songRounds: [1, 20],
  songPerRound: [1, 50],
  jeoCategories: [1, 10],
} as const;

const LIST_LIMITS = {
  jeoPoints: { label: 'Jeopardy-Punkte', max: 10 },
} as const;

export function updateSettings(raw: unknown): Result<PoolSettings> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Ungültige Einstellungen' };
  const input = raw as Record<string, unknown>;
  const next = { ...getPool().settings };
  for (const key of Object.keys(NUMBER_LIMITS) as (keyof typeof NUMBER_LIMITS)[]) {
    const value = input[key];
    if (value === undefined) continue;
    const [min, max] = NUMBER_LIMITS[key];
    if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
      return { ok: false, error: `${key} muss zwischen ${min} und ${max} liegen` };
    }
    next[key] = value as number;
  }
  if (input.picTiers !== undefined) {
    const tiers = Array.isArray(input.picTiers) ? input.picTiers.map((t) => ({ until: Number(t?.until), points: Number(t?.points) })) : [];
    const ok =
      tiers.length >= 1 &&
      tiers.length <= 10 &&
      tiers.every((t, i) => Number.isInteger(t.points) && t.points >= 0 && t.points <= 500 && t.until > 0 && t.until <= 100 && (i === 0 || t.until > tiers[i - 1].until));
    if (!ok) return { ok: false, error: 'Bildrätsel-Stufen: bis zu 10, Prozent aufsteigend bis 100, Punkte ganze Zahlen' };
    next.picTiers = tiers;
  }
  for (const key of Object.keys(LIST_LIMITS) as (keyof typeof LIST_LIMITS)[]) {
    const value = input[key];
    if (value === undefined) continue;
    const { label, max } = LIST_LIMITS[key];
    const list = Array.isArray(value) ? value : [];
    if (list.length < 1 || list.length > max || list.some((v) => !Number.isInteger(v) || v < 0 || v > 10000)) {
      return { ok: false, error: `${label}: 1 bis ${max} ganze Zahlen ab 0` };
    }
    next[key] = list as number[];
  }
  getPool().settings = next;
  savePool();
  return { ok: true, value: next };
}
