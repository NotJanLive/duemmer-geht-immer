// Shared types for server and client of "Dümmer geht Immer"

import { MapId, PicTier, PictureKind, tierPoints } from './pool';

export type Mode = 'lastManStanding' | 'millionaire' | 'higherLower' | 'geo' | 'pictures' | 'songs' | 'jeopardy';
export type Screen = 'lobby' | 'draw' | Mode | 'leaderboard' | 'finale';
export type Role = 'host' | 'player' | 'viewer';

export const MODE_ORDER: Mode[] = ['lastManStanding', 'millionaire', 'higherLower', 'geo', 'pictures', 'songs', 'jeopardy'];

// Jeopardy is always the last mode of a show. The host picks and orders the rest.
export const FINAL_MODE: Mode = 'jeopardy';
export const PLANNABLE_MODES: Mode[] = MODE_ORDER.filter((m) => m !== FINAL_MODE);
export const DEFAULT_PLAN: Mode[] = ['lastManStanding', 'millionaire', 'higherLower', FINAL_MODE];

export const SCREEN_LABELS: Record<Screen, string> = {
  lobby: 'Lobby',
  draw: 'Auslosung',
  lastManStanding: 'Last Man Standing',
  millionaire: 'Wer wird Millionär?',
  higherLower: 'Higher or Lower',
  geo: 'Wo liegt das?',
  pictures: 'Bildrätsel',
  songs: 'Songrätsel',
  jeopardy: 'Jeopardy',
  leaderboard: 'Punktestand',
  finale: 'Finale',
};

export const HOL_MAX_LIVES = 2;

// Slot machine at the start: one reel per drawn game, stopping one after
// another, then Jeopardy locks in as the final.
export const DRAW_FIRST_STOP_MS = 2600;
export const DRAW_STEP_MS = 1300;
export const drawDuration = (games: number) => DRAW_FIRST_STOP_MS + games * DRAW_STEP_MS + 600;

export interface Player {
  id: string; // Discord user id
  name: string;
  avatar: string | null;
  cam: string; // VDO.Ninja stream id
  camOn: boolean; // publishing right now, so others mount a viewer
  connected: boolean;
  totalScore: number;
  modeScore: number;
}

// Last Man Standing

export interface LmsCard {
  id: string;
  value: string; // empty for players until revealed
  revealed: boolean;
}

export interface LmsRound {
  topic: string;
  cards: LmsCard[];
  currentPlayerId: string | null;
  eliminated: string[]; // player ids in elimination order
  awarded: Record<string, number>; // points this round has added to modeScore
  scored: boolean; // survivors have been paid out
}

export interface LmsState {
  roundIndex: number;
  pointsPerPlace: number;
  rounds: LmsRound[];
}

// Wer wird Millionär

export interface WwmQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // -1 for players until revealed
  points: number;
}

export interface WwmAnswer {
  answer: number | null; // null for other players until revealed
  locked: boolean;
  correct?: boolean;
}

export interface WwmState {
  index: number;
  total: number;
  question: WwmQuestion;
  answers: Record<string, WwmAnswer>;
  revealed: boolean;
}

// Higher or Lower

export interface HolItem {
  id: string;
  label: string;
  value: number | null; // null for players until placed
  placed: boolean;
  initial: boolean;
}

export interface HolRound {
  topic: string;
  unit: string;
  items: HolItem[];
  currentPlayerId: string | null;
}

export interface HolState {
  roundIndex: number;
  points: number; // per correct placement
  rounds: HolRound[];
  lives: Record<string, number>;
}

// Wo liegt das?

export interface GeoGuess {
  lat: number;
  lng: number;
}

export interface GeoResult {
  distanceKm: number;
  points: number;
}

export interface GeoState {
  category: string;
  map: MapId;
  minKm: number;
  maxPoints: number;
  index: number;
  total: number;
  place: { name: string; image: string | null; lat: number | null; lng: number | null }; // lat/lng null for players until revealed
  endsAt: number; // server time when pins can no longer be set
  guesses: Record<string, GeoGuess | null>; // for players: own pin only until revealed, others null (key = has set a pin)
  revealed: boolean;
  revealedAt: number | null; // server time of the reveal, for the animation
  results: Record<string, GeoResult>;
}

// Bildrätsel

export interface PicState {
  category: string;
  kind: PictureKind;
  roundIndex: number;
  roundCount: number;
  itemIndex: number;
  itemCount: number;
  image: string | null; // null for players until started
  answer: string | null; // null for players until solved
  seed: number; // tile order and zoom point
  status: 'ready' | 'running' | 'paused' | 'solved';
  elapsedMs: number; // running time before runningSince
  runningSince: number | null; // server time
  // Everyone who buzzed, in order, with how far the picture was at their buzz.
  // The first one still waiting answers; a wrong answer hands over to the next.
  queue: PicBuzz[];
  answeringId: string | null; // first waiting in the queue
  winnerId: string | null;
  awarded: number;
  tiers: PicTier[];
  revealSeconds: number;
}

export interface PicBuzz {
  playerId: string;
  progress: number; // 0..1
  wrong: boolean;
}

// How far the picture is revealed after `ms` of running time, 0..1.
export function picProgress(pic: Pick<PicState, 'revealSeconds'>, ms: number): number {
  return Math.min(1, ms / (pic.revealSeconds * 1000));
}

export function picPoints(pic: Pick<PicState, 'tiers'>, progress: number): number {
  return tierPoints(pic.tiers, progress);
}

// Songrätsel

// One guess per player and song, locked in at a stage: the earlier, the more
// it is worth if right. Right or wrong stays secret until the reveal.
export interface SongGuess {
  stage: number; // index into SONG_STAGES when it was locked in
  trackId: number; // 0 for other players until revealed
  title: string; // empty for other players until revealed
  artist: string;
  cover: string;
  correct: boolean | null; // null for players until revealed
  points: number; // given at the reveal
}

export interface SongAnswer {
  trackId: number;
  title: string;
  artist: string;
  cover: string;
}

export interface SongState {
  category: string;
  roundIndex: number;
  roundCount: number;
  itemIndex: number;
  itemCount: number;
  preview: string; // 30 s iTunes preview
  offset: number; // seconds into the preview where the snippet starts
  stage: number; // longest snippet unlocked, index into SONG_STAGES
  play: { stage: number; at: number } | null; // last play command, server time
  revealed: boolean;
  // The whole preview after the reveal: playing since `at` from second `from`,
  // or paused at `pausedAt` seconds.
  reveal: { at: number; from: number } | null;
  pausedAt: number | null;
  answer: SongAnswer | null; // null for players until revealed
  guesses: Record<string, SongGuess>;
  extend: string[]; // players asking for a longer snippet at this stage
}

// Jeopardy

export interface JeoQuestion {
  id: string;
  question: string | null; // null for players while unplayed
  answer: string | null; // null for players while unplayed or active
  points: number;
  status: 'open' | 'answered' | 'discarded';
  answeredBy?: string;
  chooserId?: string; // who picked the field
  attempts?: JeoAttempt[]; // every judged answer in order
}

export interface JeoAttempt {
  playerId: string;
  correct: boolean;
}

export interface JeoCategory {
  name: string;
  questions: JeoQuestion[];
}

export interface JeoActive {
  categoryIndex: number;
  questionIndex: number;
  points: number; // won by a right answer
  originalPoints: number;
  penalty: number; // taken from every wrong answer (half the field)
  answeringId: string | null;
  buzzerOpen: boolean;
  tried: string[];
  firstAttempt: boolean; // chooser answers without buzzer
}

export interface JeoState {
  categories: JeoCategory[];
  chooserId: string | null;
  active: JeoActive | null;
}

export interface ShowHost {
  id: string;
  name: string;
  avatar: string | null;
  cam: string;
  camOn: boolean;
}

export interface GameState {
  showId: string;
  host: ShowHost;
  hostConnected: boolean;
  screen: Screen;
  plan: Mode[]; // modes of this show in order, always ending with FINAL_MODE
  randomCount: number | null; // lobby: draw this many games at the start instead of the plan
  drawStartedAt: number | null; // server time the slot machine started
  modeIndex: number; // index into plan of the current or last played mode
  poolCounts?: Record<Mode, number>; // host only, entries per mode in the pool
  players: Player[];
  lms: LmsState | null;
  wwm: WwmState | null;
  hol: HolState | null;
  geo: GeoState | null;
  pic: PicState | null;
  song: SongState | null;
  jeo: JeoState | null;
  finaleStartedAt: number | null;
  serverTime: number;
}

export type HostAction =
  | { type: 'start' }
  | { type: 'kick'; playerId: string }
  | { type: 'plan.set'; modes: Mode[] }
  | { type: 'plan.random'; count: number | null }
  | { type: 'draw.done' }
  | { type: 'showLeaderboard' }
  | { type: 'nextMode' }
  | { type: 'closeShow' }
  | { type: 'finale.start' }
  | { type: 'lms.reveal'; cardId: string }
  | { type: 'lms.toggleEliminated'; playerId: string }
  | { type: 'lms.skip' }
  | { type: 'lms.nextRound' }
  | { type: 'wwm.reveal' }
  | { type: 'wwm.next' }
  | { type: 'hol.place'; itemId: string }
  | { type: 'hol.unplace'; itemId: string }
  | { type: 'hol.lives'; playerId: string; delta: number }
  | { type: 'hol.points'; playerId: string; delta: number }
  | { type: 'hol.nextPlayer' }
  | { type: 'hol.nextRound' }
  | { type: 'geo.reveal' }
  | { type: 'geo.next' }
  | { type: 'pic.start' }
  | { type: 'pic.judge'; correct: boolean }
  | { type: 'pic.solve' }
  | { type: 'pic.next' }
  | { type: 'song.play' }
  | { type: 'song.stage' }
  | { type: 'song.reveal' }
  | { type: 'song.next' }
  | { type: 'song.pause' }
  | { type: 'jeo.select'; categoryIndex: number; questionIndex: number }
  | { type: 'jeo.judge'; correct: boolean }
  | { type: 'jeo.buzzer'; open: boolean }
  | { type: 'jeo.resetBuzzer' }
  | { type: 'jeo.discard' };

export type PlayerAction =
  | { type: 'wwm.select'; answer: number }
  | { type: 'wwm.lock' }
  | { type: 'geo.guess'; lat: number; lng: number }
  | { type: 'pic.buzz' }
  | { type: 'song.guess'; trackId: number; title: string; artist: string; cover: string }
  | { type: 'song.extend' }
  | { type: 'jeo.buzz' };

export interface EnterReply {
  ok: boolean;
  error?: string;
  role?: Role;
  playerId?: string | null;
}

// What every logged-in page sees about the live show.
export interface LiveInfo {
  active: boolean;
  screen?: Screen;
  host?: ShowHost;
  playerIds?: string[];
  startedAt?: number;
}

export interface ServerToClientEvents {
  state: (state: GameState) => void;
  live: (info: LiveInfo) => void;
  closed: (message: string) => void;
}

export interface ClientToServerEvents {
  // Attaches this socket to the live show as host, player or viewer.
  enter: (opts: { join?: boolean }, reply: (r: EnterReply) => void) => void;
  createShow: (reply: (r: EnterReply) => void) => void;
  leaveShow: () => void;
  cam: (on: boolean) => void;
  host: (action: HostAction) => void;
  player: (action: PlayerAction) => void;
}
