import { randomUUID } from 'crypto';
import { GameState, LiveInfo, Player, ShowHost } from '../src/types/game';
import { Game, createGame } from './game';
import { poolCounts } from './pool';
import { camId } from './auth';
import { ShowRecord, UserRecord } from './db';

export interface Show {
  id: string;
  host: ShowHost;
  hostSockets: Set<string>;
  playerSockets: Map<string, Set<string>>; // Discord user id -> socket ids
  viewerSockets: Set<string>;
  game: Game;
  startedAt: number;
  recorded: ShowRecord | null; // set when the finale is reached
  awardTimer: NodeJS.Timeout | null;
}

// There is only ever one show: the one the host is running right now.
let live: Show | null = null;

export const getLive = () => live;

export function createShow(host: UserRecord): Show {
  live = {
    id: randomUUID(),
    host: { id: host.id, name: host.name, avatar: host.avatar, cam: camId(host.id), camOn: false },
    hostSockets: new Set(),
    playerSockets: new Map(),
    viewerSockets: new Set(),
    game: createGame(),
    startedAt: Date.now(),
    recorded: null,
    awardTimer: null,
  };
  return live;
}

export function endShow() {
  live = null;
}

export function liveInfo(): LiveInfo {
  if (!live) return { active: false };
  return {
    active: true,
    screen: live.game.screen,
    host: live.host,
    playerIds: live.game.players.map((p) => p.id),
    startedAt: live.startedAt,
  };
}

export type JoinResult = { player: Player } | { error: string };

// A member joins, or gets their seat back. New players only in the lobby.
export function joinShow(show: Show, user: UserRecord): JoinResult {
  const game = show.game;
  const own = game.players.find((p) => p.id === user.id);
  if (own) {
    if (game.screen === 'lobby') {
      own.name = user.name;
      own.avatar = user.avatar;
    }
    return { player: own };
  }
  if (game.screen !== 'lobby') return { error: 'Die Show läuft bereits' };
  const player: Player = {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    cam: camId(user.id),
    camOn: false,
    connected: false,
    totalScore: 0,
    modeScore: 0,
  };
  game.players.push(player);
  return { player };
}

export function removePlayer(show: Show, playerId: string) {
  show.game.players = show.game.players.filter((p) => p.id !== playerId);
  show.playerSockets.delete(playerId);
}

export function attachPlayerSocket(show: Show, playerId: string, socketId: string) {
  let sockets = show.playerSockets.get(playerId);
  if (!sockets) show.playerSockets.set(playerId, (sockets = new Set()));
  sockets.add(socketId);
  syncConnected(show);
}

export function detachSocket(show: Show, socketId: string) {
  show.hostSockets.delete(socketId);
  show.viewerSockets.delete(socketId);
  for (const sockets of show.playerSockets.values()) sockets.delete(socketId);
  syncConnected(show);
}

function syncConnected(show: Show) {
  for (const p of show.game.players) {
    p.connected = (show.playerSockets.get(p.id)?.size ?? 0) > 0;
    if (!p.connected) p.camOn = false;
  }
  if (show.hostSockets.size === 0) show.host.camOn = false;
}

// Views. The host sees everything. Players only see what is already public.

export function hostView(show: Show): GameState {
  const { game } = show;
  const { wwm, geo } = game;
  return {
    showId: show.id,
    host: show.host,
    hostConnected: show.hostSockets.size > 0,
    screen: game.screen,
    plan: game.plan,
    randomCount: game.randomCount,
    drawStartedAt: game.drawStartedAt,
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
      revealedAt: geo.revealedAt,
      results: geo.results,
    },
    pic: game.pic?.current ?? null,
    song: game.song?.current ?? null,
    jeo: game.jeo,
    finaleStartedAt: game.finaleStartedAt,
    serverTime: Date.now(),
  };
}

export function playerView(full: GameState): GameState {
  const view: GameState = { ...full, poolCounts: undefined };
  // The games stay secret until the slot machine shows them.
  if (full.screen === 'lobby') view.plan = [];

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

  // Songrätsel: no answer before the reveal, and the other players' guesses
  // only as right or wrong (their own come in the personal view).
  if (full.song && !full.song.revealed) {
    view.song = {
      ...full.song,
      answer: null,
      guesses: Object.fromEntries(
        Object.entries(full.song.guesses).map(([id, g]) => [id, { ...g, trackId: 0, title: '', artist: '', cover: '', correct: null }]),
      ),
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
  return (!!base.wwm && !base.wwm.revealed) || (!!base.geo && !base.geo.revealed) || (!!base.song && !base.song.revealed);
}

export function personalView(base: GameState, playerId: string, full: GameState): GameState {
  let view = base;
  if (base.wwm && !base.wwm.revealed && full.wwm?.answers[playerId]) {
    view = { ...view, wwm: { ...base.wwm, answers: { ...base.wwm.answers, [playerId]: full.wwm.answers[playerId] } } };
  }
  // Your own pick, but not yet whether it is right.
  if (base.song && !base.song.revealed && full.song?.guesses[playerId]) {
    const own = { ...full.song.guesses[playerId], correct: null };
    view = { ...view, song: { ...base.song, guesses: { ...base.song.guesses, [playerId]: own } } };
  }
  if (base.geo && !base.geo.revealed && full.geo?.guesses[playerId]) {
    view = { ...view, geo: { ...base.geo, guesses: { ...base.geo.guesses, [playerId]: full.geo.guesses[playerId] } } };
  }
  return view;
}
