// Shared types for server and client of "Dümmer geht Immer"

export type Mode = 'lastManStanding' | 'millionaire' | 'higherLower' | 'jeopardy';
export type Screen = 'lobby' | Mode | 'leaderboard' | 'finale';
export type Role = 'host' | 'player';

export const MODE_ORDER: Mode[] = ['lastManStanding', 'millionaire', 'higherLower', 'jeopardy'];

export const SCREEN_LABELS: Record<Screen, string> = {
  lobby: 'Lobby',
  lastManStanding: 'Last Man Standing',
  millionaire: 'Wer wird Millionär?',
  higherLower: 'Higher or Lower',
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
  rounds: HolRound[];
  lives: Record<string, number>;
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
  modeIndex: number; // index into MODE_ORDER of the current or last played mode
  players: Player[];
  lms: LmsState | null;
  wwm: WwmState | null;
  hol: HolState | null;
  jeo: JeoState | null;
  finaleStartedAt: number | null;
  serverTime: number;
}

export type HostAction =
  | { type: 'start' }
  | { type: 'kick'; playerId: string }
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
  | { type: 'jeo.select'; categoryIndex: number; questionIndex: number }
  | { type: 'jeo.judge'; correct: boolean }
  | { type: 'jeo.buzzer'; open: boolean }
  | { type: 'jeo.resetBuzzer' }
  | { type: 'jeo.discard' };

export type PlayerAction =
  | { type: 'wwm.select'; answer: number }
  | { type: 'wwm.lock' }
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
