import { randomUUID } from 'crypto';
import { GameState, Player } from '../src/types/game';
import { Game, createGame } from './game';
import { poolCounts } from './pool';

export interface Room {
  code: string;
  hostName: string;
  hostSessionId: string;
  sessions: Map<string, string>; // player sessionId -> playerId
  hostSockets: Set<string>;
  playerSockets: Map<string, Set<string>>; // playerId -> socket ids
  game: Game;
  lastActivity: number;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_NAME_LENGTH = 20;
const IDLE_ROOM_TTL = 6 * 60 * 60 * 1000;

export const rooms = new Map<string, Room>();

export function normalizeCode(code: unknown): string {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

export function cleanName(name: unknown): string {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH) : '';
}

function generateCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

export function createRoom(hostName: string): Room {
  const room: Room = {
    code: generateCode(),
    hostName,
    hostSessionId: randomUUID(),
    sessions: new Map(),
    hostSockets: new Set(),
    playerSockets: new Map(),
    game: createGame(),
    lastActivity: Date.now(),
  };
  rooms.set(room.code, room);
  return room;
}

export type JoinResult = { player: Player; sessionId: string } | { error: string };

// Joins a player, or hands an existing seat back to them. A seat is reused for
// the same browser session, or by name when that player is offline (new device,
// cleared storage). New players can only join in the lobby.
export function joinRoom(room: Room, name: string, sessionId: string | null): JoinResult {
  const game = room.game;
  const ownId = sessionId ? room.sessions.get(sessionId) : undefined;
  const own = ownId ? game.players.find((p) => p.id === ownId) : undefined;
  const sameName = game.players.find((p) => p.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));

  if (own && (!sameName || sameName === own)) {
    if (game.screen === 'lobby') own.name = name;
    return { player: own, sessionId: sessionId! };
  }
  if (sameName) {
    if (sameName.connected) return { error: 'Der Name ist schon vergeben' };
    const newSession = randomUUID();
    for (const [sid, pid] of room.sessions) if (pid === sameName.id) room.sessions.delete(sid);
    room.sessions.set(newSession, sameName.id);
    return { player: sameName, sessionId: newSession };
  }
  if (game.screen !== 'lobby') return { error: 'Das Spiel läuft bereits' };

  const player: Player = { id: randomUUID(), name, connected: false, totalScore: 0, modeScore: 0 };
  const newSession = randomUUID();
  game.players.push(player);
  room.sessions.set(newSession, player.id);
  return { player, sessionId: newSession };
}

export function removePlayer(room: Room, playerId: string) {
  room.game.players = room.game.players.filter((p) => p.id !== playerId);
  for (const [sid, pid] of room.sessions) if (pid === playerId) room.sessions.delete(sid);
  room.playerSockets.delete(playerId);
}

export function attachPlayerSocket(room: Room, playerId: string, socketId: string) {
  let sockets = room.playerSockets.get(playerId);
  if (!sockets) room.playerSockets.set(playerId, (sockets = new Set()));
  sockets.add(socketId);
  syncConnected(room);
}

export function detachSocket(room: Room, socketId: string) {
  room.hostSockets.delete(socketId);
  for (const sockets of room.playerSockets.values()) sockets.delete(socketId);
  syncConnected(room);
}

function syncConnected(room: Room) {
  for (const p of room.game.players) p.connected = (room.playerSockets.get(p.id)?.size ?? 0) > 0;
  room.lastActivity = Date.now();
}

export function isRoomIdle(room: Room, now: number): boolean {
  const anyone = room.hostSockets.size > 0 || [...room.playerSockets.values()].some((s) => s.size > 0);
  return !anyone && now - room.lastActivity > IDLE_ROOM_TTL;
}

// Views. The host sees everything. Players only see what is already public.

export function hostView(room: Room): GameState {
  const { game } = room;
  const { wwm, geo } = game;
  return {
    roomCode: room.code,
    hostName: room.hostName,
    hostConnected: room.hostSockets.size > 0,
    screen: game.screen,
    plan: game.plan,
    modeIndex: game.modeIndex,
    poolCounts: game.screen === 'lobby' ? poolCounts() : undefined,
    players: game.players,
    lms: game.lms,
    wwm: wwm && {
      index: wwm.index,
      total: wwm.questions.length,
      question: wwm.questions[wwm.index],
      answers: wwm.answers,
      revealed: wwm.revealed,
    },
    hol: game.hol,
    geo: geo && {
      category: geo.category,
      map: geo.map,
      minKm: geo.minKm,
      maxPoints: geo.maxPoints,
      index: geo.index,
      total: geo.places.length,
      place: {
        name: geo.places[geo.index].name,
        image: geo.places[geo.index].image ?? null,
        lat: geo.places[geo.index].lat,
        lng: geo.places[geo.index].lng,
      },
      endsAt: geo.endsAt,
      guesses: geo.guesses,
      revealed: geo.revealed,
      results: geo.results,
    },
    pic: game.pic?.current ?? null,
    jeo: game.jeo,
    finaleStartedAt: game.finaleStartedAt,
    serverTime: Date.now(),
  };
}

export function playerView(room: Room, full: GameState): GameState {
  const view: GameState = { ...full, poolCounts: undefined };

  // Totals stay secret until the finale to keep the suspense.
  if (full.screen !== 'finale') view.players = full.players.map((p) => ({ ...p, totalScore: 0 }));

  if (full.lms) {
    view.lms = {
      ...full.lms,
      rounds: full.lms.rounds.map((round, i) =>
        i !== full.lms!.roundIndex
          ? { ...round, cards: [] }
          : { ...round, cards: round.cards.map((c) => (c.revealed ? c : { ...c, value: '' })) },
      ),
    };
  }

  if (full.wwm && !full.wwm.revealed) {
    view.wwm = {
      ...full.wwm,
      question: { ...full.wwm.question, correctAnswer: -1 },
      answers: Object.fromEntries(
        Object.entries(full.wwm.answers).map(([id, a]) => [id, { answer: null, locked: a.locked }]),
      ),
    };
  }

  if (full.hol) {
    view.hol = {
      ...full.hol,
      rounds: full.hol.rounds.map((round, i) =>
        i !== full.hol!.roundIndex
          ? { ...round, items: [] }
          : { ...round, items: round.items.map((item) => (item.placed ? item : { ...item, value: null })) },
      ),
    };
  }

  if (full.geo && !full.geo.revealed) {
    view.geo = {
      ...full.geo,
      place: { ...full.geo.place, lat: null, lng: null },
      guesses: Object.fromEntries(Object.keys(full.geo.guesses).map((id) => [id, null])),
    };
  }

  if (full.pic) {
    view.pic = {
      ...full.pic,
      image: full.pic.status === 'ready' ? null : full.pic.image,
      answer: full.pic.status === 'solved' ? full.pic.answer : null,
    };
  }

  if (full.jeo) {
    const active = full.jeo.active;
    view.jeo = {
      ...full.jeo,
      categories: full.jeo.categories.map((cat, c) => ({
        ...cat,
        questions: cat.questions.map((q, i) => {
          if (q.status !== 'open') return q;
          const isActive = active?.categoryIndex === c && active.questionIndex === i;
          return { ...q, question: isActive ? q.question : null, answer: null };
        }),
      })),
    };
  }

  return view;
}

// Players need a personal view while their own pick is secret: the
// Millionaire answer and the Wo liegt das? pin.
export function needsPersonalView(base: GameState): boolean {
  return (!!base.wwm && !base.wwm.revealed) || (!!base.geo && !base.geo.revealed);
}

export function personalView(base: GameState, playerId: string, full: GameState): GameState {
  let view = base;
  if (base.wwm && !base.wwm.revealed && full.wwm?.answers[playerId]) {
    view = { ...view, wwm: { ...base.wwm, answers: { ...base.wwm.answers, [playerId]: full.wwm.answers[playerId] } } };
  }
  if (base.geo && !base.geo.revealed && full.geo?.guesses[playerId]) {
    view = { ...view, geo: { ...base.geo, guesses: { ...base.geo.guesses, [playerId]: full.geo.guesses[playerId] } } };
  }
  return view;
}
