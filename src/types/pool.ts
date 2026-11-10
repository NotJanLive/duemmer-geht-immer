// Question pool shared by the server and the admin page.

export type PoolMode = 'lastManStanding' | 'millionaire' | 'higherLower' | 'geo' | 'pictures' | 'songs' | 'jeopardy';

export const POOL_MODES: PoolMode[] = ['lastManStanding', 'millionaire', 'higherLower', 'geo', 'pictures', 'songs', 'jeopardy'];

// Uploaded images are served from /media/<file>.
export const MEDIA_PATTERN = /^\/media\/[a-f0-9-]+\.(jpg|jpeg|png|webp|gif|avif)$/;

// What the admin edits and imports. Ids and play stats are added by the server.
export interface LmsContent {
  topic: string;
  items: string[];
}

// Millionaire is always 30 questions: two worth 1 point, two worth 2, up to
// two worth 15. A question's points are its difficulty.
export const WWM_MAX_POINTS = 15;
export const WWM_PER_LEVEL = 2;
export const WWM_QUESTIONS = WWM_MAX_POINTS * WWM_PER_LEVEL;

export interface WwmContent {
  question: string;
  options: string[];
  answer: number; // index into options
  points: number;
}

export interface HolContent {
  topic: string;
  unit: string;
  items: { label: string; value: number }[];
}

// Board points come from the row.
export interface JeoContent {
  name: string;
  questions: { question: string; answer: string }[];
}

// "Wo liegt das?": one category per show, its places are guessed on an outline
// map. There is one world map, the category picks the region it opens on
// (view: west, south, east, north) and its distances for scoring.
export type MapId = 'de' | 'eu' | 'world';

export const MAPS: Record<MapId, { label: string; view: [number, number, number, number]; minKm: number }> = {
  de: { label: 'Deutschland', view: [5.6, 47.1, 15.3, 55.2], minKm: 400 },
  eu: { label: 'Europa', view: [-25, 34, 45, 71.5], minKm: 2000 },
  world: { label: 'Welt', view: [-180, -58, 180, 84], minKm: 6000 },
};

export const GEO_MIN_POINTS = 1;

export interface GeoPlace {
  name: string;
  lat: number;
  lng: number;
  image?: string; // optional photo instead of only the name
}

export interface GeoContent {
  name: string;
  map: MapId;
  minKm: number; // from this distance on there is only the minimum
  places: GeoPlace[];
}

// No fixed radius: points fall smoothly from the first metre down to the
// minimum at minKm, faster at first so near misses already cost something.
// Germany (400 km, max 15): 10 km 14, 25 km 13, 50 km 12, 91 km 9, 150 km 6,
// 200 km 5, 300 km 2, 400 km 1.
export function geoPoints(distanceKm: number, minKm: number, max: number): number {
  const left = Math.max(0, 1 - distanceKm / Math.max(1, minKm));
  return Math.round(GEO_MIN_POINTS + (max - GEO_MIN_POINTS) * left ** 2);
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Bildrätsel: a category is one round, all its pictures use the same effect.
// Zoom and "whole picture" were dropped (2026-11-05), they fall back to pixel.
// Blur is Schmobin's "Wer checkts am schnellsten?": blurred and grey, getting
// sharp and colourful.
export type PictureKind = 'blur' | 'pixel' | 'reveal';

export const PICTURE_KINDS: Record<PictureKind, string> = {
  blur: 'Unscharf',
  pixel: 'Verpixelt',
  reveal: 'Aufdecken',
};

// Points for a buzz by how far the picture was revealed: the first tier whose
// `until` (percent) is not passed yet.
export interface PicTier {
  until: number;
  points: number;
}

export function tierPoints(tiers: PicTier[], progress: number): number {
  const percent = progress * 100;
  return tiers.find((t) => percent <= t.until)?.points ?? 0;
}

export interface PicContent {
  name: string;
  kind: PictureKind;
  items: { image: string; answer: string }[];
}

// Songrätsel: a category is one round of songs. Audio and search come from
// Apple's iTunes Search API (free, no login): every track has a 30 s preview in
// good quality (AAC ~256 kbit/s), stable URLs, CORS open. Spotify no longer
// gives previews to new apps (Nov 2024) and full playback would need Premium
// for every player, so it is not used. `offset` is where in the 30 s preview
// the snippet starts.
export interface SongItem {
  trackId: number;
  title: string;
  artist: string;
  cover: string;
  preview: string;
  offset: number; // seconds into the preview
}

export interface SongContent {
  name: string;
  songs: SongItem[];
}

// Snippet lengths in seconds and what a right guess at that stage is worth.
export const SONG_STAGES = [0.2, 0.5, 1, 3, 5];
export const SONG_POINTS = [5, 4, 3, 2, 1];
export const SONG_PREVIEW_SECONDS = 30;

export const ITUNES_PREVIEW = /^https:\/\/audio-ssl\.itunes\.apple\.com\/itunes-assets\/[\w/.-]+\.m4a$/;
export const ITUNES_COVER = /^https:\/\/is\d-ssl\.mzstatic\.com\/[\w/.,%-]+$/;

// "Mr. Brightside (Remastered 2019) [feat. X]" -> "mr brightside". A guess is
// right for the same track or the same title by the same main artist, so other
// versions of the song count too.
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function mainArtist(artist: string): string {
  return normalizeTitle(artist.split(/,|&| feat\.?| ft\.?| x | und /i)[0] ?? artist);
}

export function sameSong(a: { trackId: number; title: string; artist: string }, b: { trackId: number; title: string; artist: string }): boolean {
  if (a.trackId === b.trackId) return true;
  return normalizeTitle(a.title) === normalizeTitle(b.title) && mainArtist(a.artist) === mainArtist(b.artist);
}

export interface PoolContent {
  lastManStanding: LmsContent;
  millionaire: WwmContent;
  higherLower: HolContent;
  geo: GeoContent;
  pictures: PicContent;
  songs: SongContent;
  jeopardy: JeoContent;
}

export interface PoolMeta {
  id: string;
  createdAt: number;
  playCount: number;
  lastPlayedAt: number | null;
}

export type PoolEntry<M extends PoolMode> = PoolContent[M] & PoolMeta;

// How much of each mode one show uses and what it is worth. Jeopardy has one
// points entry per board row, so its length is also the number of rows.
export interface PoolSettings {
  lmsRounds: number;
  lmsPointsPerPlace: number; // last place gets this, every place above one step more
  holRounds: number;
  holPoints: number; // per correct placement
  geoMaxPoints: number; // a pin right on the spot
  geoRounds: number; // places per show
  geoSeconds: number; // time to set a pin
  picRounds: number; // categories per show
  picPerRound: number; // pictures per category
  picTiers: PicTier[]; // points by reveal progress, Schmobin's 5 / 3 / 1
  picRevealSeconds: number; // until the picture is fully shown
  songRounds: number; // categories per show
  songPerRound: number; // songs per category
  jeoCategories: number;
  jeoPoints: number[];
}

export const DEFAULT_SETTINGS: PoolSettings = {
  lmsRounds: 5,
  lmsPointsPerPlace: 5,
  holRounds: 3,
  holPoints: 10,
  geoMaxPoints: 15,
  geoRounds: 10,
  geoSeconds: 30,
  picRounds: 4,
  picPerRound: 5,
  picTiers: [
    { until: 40, points: 5 },
    { until: 65, points: 3 },
    { until: 100, points: 1 },
  ],
  picRevealSeconds: 60,
  songRounds: 1,
  songPerRound: 10,
  jeoCategories: 5,
  jeoPoints: [10, 20, 30, 40, 50],
};

export interface PoolData {
  version: 1;
  settings: PoolSettings;
  entries: { [M in PoolMode]: PoolEntry<M>[] };
}
