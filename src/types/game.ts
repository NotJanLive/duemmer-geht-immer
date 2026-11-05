// Shared types for server and client of "Dümmer geht Immer"

import { MapId, PicTier, PictureKind, tierPoints } from './pool';

export type Mode = 'lastManStanding' | 'millionaire' | 'higherLower' | 'geo' | 'pictures' | 'jeopardy';
export type Screen = 'lobby' | Mode | 'leaderboard' | 'finale';
export type Role = 'host' | 'player';

export const MODE_ORDER: Mode[] = ['lastManStanding', 'millionaire', 'higherLower', 'geo', 'pictures', 'jeopardy'];

// Jeopardy is always the last mode of a show. The host picks and orders the rest.
export const FINAL_MODE: Mode = 'jeopardy';
export const PLANNABLE_MODES: Mode[] = MODE_ORDER.filter((m) => m !== FINAL_MODE);
export const DEFAULT_PLAN: Mode[] = ['lastManStanding', 'millionaire', 'higherLower', FINAL_MODE];

export const SCREEN_LABELS: Record<Screen, string> = {
  lobby: 'Lobby',
  lastManStanding: 'Last Man Standing',
  millionaire: 'Wer wird Millionär?',
  higherLower: 'Higher or Lower',
  geo: 'Wo liegt das?',
  pictures: 'Bildrätsel',
  jeopardy: 'Jeopardy',
  leaderboard: 'Punktestand',
  finale: 'Finale',
};

export const HOL_MAX_LIVES = 2;

export interface Player {
  id: string;
  name: string;
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

// Jeopardy

export interface JeoQuestion {
  id: string;
  question: string | null; // null for players while unplayed
  answer: string | null; // null for players while unplayed or active
  points: number;
  status: 'open' | 'answered' | 'discarded';
  answeredBy?: string;
}

export interface JeoCategory {
  name: string;
  questions: JeoQuestion[];
}

export interface JeoActive {
  categoryIndex: number;
  questionIndex: number;
  points: number; // halved after the chooser answers wrong
  originalPoints: number;
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

export interface GameState {
  roomCode: string;
  hostName: string;
  hostConnected: boolean;
  screen: Screen;
  plan: Mode[]; // modes of this show in order, always ending with FINAL_MODE
  modeIndex: number; // index into plan of the current or last played mode
  poolCounts?: Record<Mode, number>; // host only, entries per mode in the pool
  players: Player[];
  lms: LmsState | null;
  wwm: WwmState | null;
  hol: HolState | null;
  geo: GeoState | null;
  pic: PicState | null;
  jeo: JeoState | null;
  finaleStartedAt: number | null;
  serverTime: number;
}

export type HostAction =
  | { type: 'start' }
  | { type: 'kick'; playerId: string }
  | { type: 'plan.set'; modes: Mode[] }
  | { type: 'showLeaderboard' }
  | { type: 'nextMode' }
  | { type: 'closeRoom' }
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
  | { type: 'jeo.buzz' };

export interface SessionReply {
  ok: boolean;
  error?: string;
  roomCode?: string;
  sessionId?: string;
  role?: Role;
  playerId?: string;
}

export interface ServerToClientEvents {
  state: (state: GameState) => void;
  closed: (message: string) => void;
}

export interface ClientToServerEvents {
  createRoom: (hostName: string, reply: (r: SessionReply) => void) => void;
  joinRoom: (roomCode: string, name: string, sessionId: string | null, reply: (r: SessionReply) => void) => void;
  resume: (roomCode: string, sessionId: string, reply: (r: SessionReply) => void) => void;
  leaveRoom: () => void;
  host: (action: HostAction) => void;
  player: (action: PlayerAction) => void;
}
