import {
  DEFAULT_PLAN,
  FINAL_MODE,
  GeoGuess,
  GeoResult,
  HOL_MAX_LIVES,
  HolState,
  HostAction,
  JeoState,
  LmsRound,
  LmsState,
  Mode,
  PLANNABLE_MODES,
  PicState,
  picPoints,
  picProgress,
  Player,
  PlayerAction,
  Screen,
  WwmAnswer,
  WwmQuestion,
} from '../src/types/game';
import { getPool, pickGeo, pickJeopardy, pickMillionaire, pickPictures, pickTopics, poolCounts } from './pool';
import { GeoContent, MapId, PicContent, PictureKind, distanceKm, geoPoints } from '../src/types/pool';

// Millionaire keeps every question on the server and only sends the current one.
export interface WwmFull {
  index: number;
  questions: WwmQuestion[];
  answers: Record<string, WwmAnswer>;
  revealed: boolean;
}

// Wo liegt das? keeps all places on the server and only sends the current one.
export interface GeoFull {
  category: string;
  map: MapId;
  minKm: number;
  maxPoints: number;
  seconds: number;
  places: GeoContent['places'];
  index: number;
  endsAt: number;
  guesses: Record<string, GeoGuess>;
  revealed: boolean;
  results: Record<string, GeoResult>;
}

// Bildrätsel keeps every round on the server. `current` is the picture shown.
export interface PicFull {
  rounds: { category: string; kind: PictureKind; items: PicContent['items'] }[];
  current: PicState;
}

export interface Game {
  screen: Screen;
  plan: Mode[];
  modeIndex: number;
  players: Player[];
  lms: LmsState | null;
  wwm: WwmFull | null;
  hol: HolState | null;
  geo: GeoFull | null;
  pic: PicFull | null;
  jeo: JeoState | null;
  finaleStartedAt: number | null;
}

export function createGame(): Game {
  return {
    screen: 'lobby',
    plan: [...DEFAULT_PLAN],
    modeIndex: 0,
    players: [],
    lms: null,
    wwm: null,
    hol: null,
    geo: null,
    pic: null,
    jeo: null,
    finaleStartedAt: null,
  };
}

// Turn order is alphabetical, like the original game.
function turnOrder(game: Game): Player[] {
  return [...game.players].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

// Next player after `currentId` that passes `eligible`. Connected players are
// preferred so a dropped player does not stall the round.
function nextPlayerId(game: Game, currentId: string | null, eligible: (p: Player) => boolean): string | null {
  const order = turnOrder(game);
  const start = order.findIndex((p) => p.id === currentId);
  const after = [...order.slice(start + 1), ...order.slice(0, start + 1)];
  const candidates = after.filter(eligible);
  return (candidates.find((p) => p.connected) ?? candidates[0])?.id ?? null;
}

function findPlayer(game: Game, id: string): Player | undefined {
  return game.players.find((p) => p.id === id);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Mode setup

function setupMode(game: Game, mode: Mode) {
  const settings = getPool().settings;
  const order = turnOrder(game);
  const starter = (round: number) => order[round % Math.max(order.length, 1)]?.id ?? null;

  switch (mode) {
    case 'lastManStanding':
      game.lms = {
        roundIndex: 0,
        pointsPerPlace: settings.lmsPointsPerPlace,
        rounds: pickTopics('lastManStanding', settings.lmsRounds).map((round, r) => ({
          topic: round.topic,
          cards: round.items.map((value, i) => ({ id: `lms-${r}-${i}`, value, revealed: false })),
          currentPlayerId: starter(r),
          eliminated: [],
          awarded: {},
          scored: false,
        })),
      };
      break;
    case 'millionaire':
      game.wwm = {
        index: 0,
        questions: pickMillionaire().map(({ entry, points }, i) => ({
          id: `wwm-${i}`,
          question: entry.question,
          options: entry.options,
          correctAnswer: entry.answer,
          points,
        })),
        answers: {},
        revealed: false,
      };
      break;
    case 'higherLower':
      game.hol = {
        roundIndex: 0,
        points: settings.holPoints,
        lives: Object.fromEntries(game.players.map((p) => [p.id, HOL_MAX_LIVES])),
        rounds: pickTopics('higherLower', settings.holRounds).map((round, r) => {
          const initial = Math.floor(Math.random() * round.items.length);
          return {
            topic: round.topic,
            unit: round.unit,
            currentPlayerId: starter(r),
            items: shuffle(
              round.items.map((item, i) => ({
                id: `hol-${r}-${i}`,
                label: item.label,
                value: item.value,
                placed: i === initial,
                initial: i === initial,
              })),
            ),
          };
        }),
      };
      break;
    case 'geo': {
      const picked = pickGeo(settings.geoRounds);
      if (!picked) break;
      game.geo = {
        category: picked.category.name,
        map: picked.category.map,
        minKm: picked.category.minKm,
        maxPoints: settings.geoMaxPoints,
        seconds: settings.geoSeconds,
        places: picked.places,
        index: 0,
        endsAt: Date.now() + settings.geoSeconds * 1000,
        guesses: {},
        revealed: false,
        results: {},
      };
      break;
    }
    case 'pictures': {
      const rounds = pickPictures(settings.picRounds, settings.picPerRound).map((r) => ({
        category: r.category.name,
        kind: r.category.kind,
        items: r.items,
      }));
      if (!rounds.length) break;
      game.pic = {
        rounds,
        current: {
          ...picItem(rounds, 0, 0),
          tiers: settings.picTiers,
          revealSeconds: settings.picRevealSeconds,
        },
      };
      break;
    }
    case 'jeopardy':
      game.jeo = {
        chooserId: starter(0),
        active: null,
        categories: pickJeopardy(settings.jeoCategories).map((cat, c) => ({
          name: cat.name,
          questions: cat.questions.slice(0, settings.jeoPoints.length).map((q, i) => ({
            id: `jeo-${c}-${i}`,
            question: q.question,
            answer: q.answer,
            points: settings.jeoPoints[i],
            status: 'open' as const,
          })),
        })),
      };
      break;
  }
}

// The picture at round r, item i, ready to start.
function picItem(rounds: PicFull['rounds'], r: number, i: number) {
  const round = rounds[r];
  return {
    category: round.category,
    kind: round.kind,
    roundIndex: r,
    roundCount: rounds.length,
    itemIndex: i,
    itemCount: round.items.length,
    image: round.items[i].image,
    answer: round.items[i].answer,
    seed: Math.floor(Math.random() * 2 ** 31),
    status: 'ready' as const,
    elapsedMs: 0,
    runningSince: null,
    queue: [],
    answeringId: null,
    winnerId: null,
    awarded: 0,
  };
}

function picElapsed(pic: PicState, now: number): number {
  return pic.elapsedMs + (pic.runningSince ? now - pic.runningSince : 0);
}

// Last Man Standing scoring. Eliminated players get their elimination rank times
// `step`, survivors one rank more than the number eliminated once the round is
// scored.
// Recomputing from scratch keeps undo exact.
function syncLmsPoints(game: Game, round: LmsRound, step: number) {
  const target: Record<string, number> = {};
  round.eliminated.forEach((id, i) => (target[id] = (i + 1) * step));
  if (round.scored) {
    for (const p of game.players) {
      if (!round.eliminated.includes(p.id)) target[p.id] = (round.eliminated.length + 1) * step;
    }
  }
  for (const p of game.players) {
    const diff = (target[p.id] ?? 0) - (round.awarded[p.id] ?? 0);
    if (diff) p.modeScore += diff;
  }
  round.awarded = target;
}

function finishCurrentMode(game: Game) {
  if (game.screen === 'lastManStanding' && game.lms) {
    const round = game.lms.rounds[game.lms.roundIndex];
    round.scored = true;
    syncLmsPoints(game, round, game.lms.pointsPerPlace);
  }
}

function closeJeopardyQuestion(game: Game, jeo: JeoState, status: 'answered' | 'discarded', answeredBy?: string) {
  const active = jeo.active!;
  const question = jeo.categories[active.categoryIndex].questions[active.questionIndex];
  question.status = status;
  question.answeredBy = answeredBy;
  jeo.active = null;
  jeo.chooserId = nextPlayerId(game, jeo.chooserId, () => true);
}

// Host actions. Returns false when the action does not apply.
export function applyHostAction(game: Game, action: HostAction): boolean {
  switch (action.type) {
    case 'plan.set': {
      if (game.screen !== 'lobby' || !Array.isArray(action.modes)) return false;
      const modes = action.modes.filter((m, i) => PLANNABLE_MODES.includes(m) && action.modes.indexOf(m) === i);
      game.plan = [...modes, FINAL_MODE];
      return true;
    }
    case 'start': {
      if (game.screen !== 'lobby' || game.players.length === 0) return false;
      // A mode without content in the pool cannot be played.
      const counts = poolCounts();
      if (game.plan.some((m) => counts[m] === 0)) return false;
      game.modeIndex = 0;
      game.screen = game.plan[0];
      setupMode(game, game.plan[0]);
      return true;
    }
    case 'showLeaderboard': {
      if (!game.plan.includes(game.screen as Mode)) return false;
      finishCurrentMode(game);
      game.screen = 'leaderboard';
      return true;
    }
    case 'nextMode': {
      if (game.screen !== 'leaderboard') return false;
      for (const p of game.players) {
        p.totalScore += p.modeScore;
        p.modeScore = 0;
      }
      game.lms = game.wwm = game.hol = game.geo = game.pic = game.jeo = null;
      game.modeIndex++;
      if (game.modeIndex < game.plan.length) {
        game.screen = game.plan[game.modeIndex];
        setupMode(game, game.screen);
      } else {
        game.screen = 'finale';
        game.finaleStartedAt = null;
      }
      return true;
    }
    case 'finale.start': {
      if (game.screen !== 'finale') return false;
      game.finaleStartedAt = Date.now();
      return true;
    }
  }

  if (game.screen === 'lastManStanding' && game.lms) return lmsAction(game, game.lms, action);
  if (game.screen === 'millionaire' && game.wwm) return wwmAction(game, game.wwm, action);
  if (game.screen === 'higherLower' && game.hol) return holAction(game, game.hol, action);
  if (game.screen === 'geo' && game.geo) return geoAction(game, game.geo, action);
  if (game.screen === 'pictures' && game.pic) return picAction(game, game.pic, action);
  if (game.screen === 'jeopardy' && game.jeo) return jeoAction(game, game.jeo, action);
  return false;
}

function lmsAction(game: Game, lms: LmsState, action: HostAction): boolean {
  const round = lms.rounds[lms.roundIndex];
  const alive = (p: Player) => !round.eliminated.includes(p.id);

  switch (action.type) {
    case 'lms.reveal': {
      const card = round.cards.find((c) => c.id === action.cardId);
      if (!card || card.revealed) return false;
      card.revealed = true;
      round.currentPlayerId = nextPlayerId(game, round.currentPlayerId, alive);
      return true;
    }
    case 'lms.toggleEliminated': {
      if (!findPlayer(game, action.playerId) || round.scored) return false;
      const at = round.eliminated.indexOf(action.playerId);
      if (at === -1) {
        round.eliminated.push(action.playerId);
        if (round.currentPlayerId === action.playerId) {
          round.currentPlayerId = nextPlayerId(game, action.playerId, alive);
        }
      } else {
        round.eliminated.splice(at, 1);
        if (!round.currentPlayerId) round.currentPlayerId = action.playerId;
      }
      syncLmsPoints(game, round, lms.pointsPerPlace);
      return true;
    }
    case 'lms.skip': {
      round.currentPlayerId = nextPlayerId(game, round.currentPlayerId, alive);
      return true;
    }
    case 'lms.nextRound': {
      if (lms.roundIndex >= lms.rounds.length - 1) return false;
      round.scored = true;
      syncLmsPoints(game, round, lms.pointsPerPlace);
      lms.roundIndex++;
      return true;
    }
  }
  return false;
}

function wwmAction(game: Game, wwm: WwmFull, action: HostAction): boolean {
  switch (action.type) {
    case 'wwm.reveal': {
      if (wwm.revealed) return false;
      const question = wwm.questions[wwm.index];
      for (const p of game.players) {
        const answer = wwm.answers[p.id];
        if (!answer) continue;
        answer.correct = answer.locked && answer.answer === question.correctAnswer;
        if (answer.correct) p.modeScore += question.points;
      }
      wwm.revealed = true;
      return true;
    }
    case 'wwm.next': {
      if (!wwm.revealed || wwm.index >= wwm.questions.length - 1) return false;
      wwm.index++;
      wwm.answers = {};
      wwm.revealed = false;
      return true;
    }
  }
  return false;
}

function holAction(game: Game, hol: HolState, action: HostAction): boolean {
  const round = hol.rounds[hol.roundIndex];

  switch (action.type) {
    case 'hol.place':
    case 'hol.unplace': {
      const item = round.items.find((i) => i.id === action.itemId);
      if (!item || item.initial) return false;
      item.placed = action.type === 'hol.place';
      return true;
    }
    case 'hol.lives': {
      if (!(action.playerId in hol.lives)) return false;
      hol.lives[action.playerId] = Math.min(HOL_MAX_LIVES, Math.max(0, hol.lives[action.playerId] + action.delta));
      return true;
    }
    case 'hol.points': {
      const player = findPlayer(game, action.playerId);
      if (!player) return false;
      if (!Number.isInteger(action.delta)) return false;
      player.modeScore = Math.max(0, player.modeScore + action.delta);
      return true;
    }
    case 'hol.nextPlayer': {
      round.currentPlayerId = nextPlayerId(game, round.currentPlayerId, (p) => (hol.lives[p.id] ?? 0) > 0);
      return true;
    }
    case 'hol.nextRound': {
      if (hol.roundIndex >= hol.rounds.length - 1) return false;
      hol.roundIndex++;
      for (const p of game.players) hol.lives[p.id] = HOL_MAX_LIVES;
      return true;
    }
  }
  return false;
}

function geoAction(game: Game, geo: GeoFull, action: HostAction): boolean {
  switch (action.type) {
    case 'geo.reveal': {
      if (geo.revealed) return false;
      const place = geo.places[geo.index];
      for (const p of game.players) {
        const guess = geo.guesses[p.id];
        if (!guess) continue;
        const km = distanceKm(guess, place);
        const points = geoPoints(km, geo.minKm, geo.maxPoints);
        geo.results[p.id] = { distanceKm: Math.round(km * 10) / 10, points };
        p.modeScore += points;
      }
      geo.revealed = true;
      return true;
    }
    case 'geo.next': {
      if (!geo.revealed || geo.index >= geo.places.length - 1) return false;
      geo.index++;
      geo.guesses = {};
      geo.results = {};
      geo.revealed = false;
      geo.endsAt = Date.now() + geo.seconds * 1000;
      return true;
    }
  }
  return false;
}

function picAction(game: Game, pic: PicFull, action: HostAction): boolean {
  const cur = pic.current;
  const now = Date.now();
  switch (action.type) {
    case 'pic.start': {
      if (cur.status !== 'ready') return false;
      cur.status = 'running';
      cur.runningSince = now;
      return true;
    }
    case 'pic.judge': {
      const head = cur.queue.find((b) => !b.wrong);
      if (cur.status !== 'paused' || !head) return false;
      if (action.correct) {
        const player = findPlayer(game, head.playerId);
        cur.awarded = picPoints(cur, head.progress);
        if (player) player.modeScore += cur.awarded;
        cur.winnerId = head.playerId;
        cur.answeringId = null;
        cur.status = 'solved';
        return true;
      }
      // Wrong: the next one in the queue answers. Only when nobody is left
      // does the picture go on.
      head.wrong = true;
      cur.answeringId = cur.queue.find((b) => !b.wrong)?.playerId ?? null;
      if (!cur.answeringId) {
        cur.status = 'running';
        cur.runningSince = now;
      }
      return true;
    }
    case 'pic.solve': {
      if (cur.status === 'solved') return false;
      cur.elapsedMs = picElapsed(cur, now);
      cur.runningSince = null;
      cur.answeringId = null;
      cur.status = 'solved';
      return true;
    }
    case 'pic.next': {
      if (cur.status !== 'solved') return false;
      let r = cur.roundIndex;
      let i = cur.itemIndex + 1;
      if (i >= pic.rounds[r].items.length) {
        r++;
        i = 0;
      }
      if (r >= pic.rounds.length) return false;
      pic.current = { ...cur, ...picItem(pic.rounds, r, i) };
      return true;
    }
  }
  return false;
}

function jeoAction(game: Game, jeo: JeoState, action: HostAction): boolean {
  const active = jeo.active;

  switch (action.type) {
    case 'jeo.select': {
      const question = jeo.categories[action.categoryIndex]?.questions[action.questionIndex];
      if (!question || question.status !== 'open' || active) return false;
      jeo.active = {
        categoryIndex: action.categoryIndex,
        questionIndex: action.questionIndex,
        points: question.points,
        originalPoints: question.points,
        answeringId: jeo.chooserId,
        buzzerOpen: false,
        tried: [],
        firstAttempt: true,
      };
      return true;
    }
    case 'jeo.judge': {
      if (!active?.answeringId) return false;
      if (action.correct) {
        const player = findPlayer(game, active.answeringId);
        if (player) player.modeScore += active.points;
        closeJeopardyQuestion(game, jeo, 'answered', active.answeringId);
        return true;
      }
      active.tried.push(active.answeringId);
      if (active.firstAttempt) {
        active.points = Math.floor(active.points / 2);
        active.firstAttempt = false;
      }
      active.answeringId = null;
      // When everyone who is online has tried, the buzzer starts over for all.
      const left = game.players.filter((p) => p.connected && !active.tried.includes(p.id));
      if (left.length === 0) active.tried = [];
      active.buzzerOpen = true;
      return true;
    }
    case 'jeo.buzzer': {
      if (!active) return false;
      active.buzzerOpen = action.open;
      if (action.open) {
        if (active.answeringId) active.tried.push(active.answeringId);
        active.answeringId = null;
        active.firstAttempt = false;
      }
      return true;
    }
    case 'jeo.resetBuzzer': {
      if (!active) return false;
      active.tried = [];
      active.answeringId = null;
      active.buzzerOpen = true;
      active.firstAttempt = false;
      return true;
    }
    case 'jeo.discard': {
      if (!active) return false;
      closeJeopardyQuestion(game, jeo, 'discarded');
      return true;
    }
  }
  return false;
}

export function applyPlayerAction(game: Game, playerId: string, action: PlayerAction): boolean {
  switch (action.type) {
    case 'wwm.select': {
      const wwm = game.screen === 'millionaire' ? game.wwm : null;
      if (!wwm || wwm.revealed) return false;
      const options = wwm.questions[wwm.index].options.length;
      if (!Number.isInteger(action.answer) || action.answer < 0 || action.answer >= options) return false;
      const current = wwm.answers[playerId];
      if (current?.locked) return false;
      wwm.answers[playerId] = { answer: action.answer, locked: false };
      return true;
    }
    case 'wwm.lock': {
      const wwm = game.screen === 'millionaire' ? game.wwm : null;
      const current = wwm?.answers[playerId];
      if (!wwm || wwm.revealed || !current || current.answer === null || current.locked) return false;
      current.locked = true;
      return true;
    }
    case 'geo.guess': {
      const geo = game.screen === 'geo' ? game.geo : null;
      if (!geo || geo.revealed || Date.now() > geo.endsAt + 1000) return false;
      const { lat, lng } = action;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
      geo.guesses[playerId] = { lat, lng };
      return true;
    }
    case 'pic.buzz': {
      const cur = game.screen === 'pictures' ? game.pic?.current : null;
      // The first buzz stops the picture; others can still join the queue at
      // the same progress until it runs again.
      if (!cur || (cur.status !== 'running' && cur.status !== 'paused') || cur.queue.some((b) => b.playerId === playerId)) return false;
      if (cur.status === 'running') {
        cur.elapsedMs = picElapsed(cur, Date.now());
        cur.runningSince = null;
        cur.status = 'paused';
      }
      cur.queue.push({ playerId, progress: picProgress(cur, cur.elapsedMs), wrong: false });
      cur.answeringId ??= playerId;
      return true;
    }
    case 'jeo.buzz': {
      const active = game.screen === 'jeopardy' ? game.jeo?.active : null;
      if (!active || !active.buzzerOpen || active.answeringId || active.tried.includes(playerId)) return false;
      active.answeringId = playerId;
      active.buzzerOpen = false;
      return true;
    }
  }
  return false;
}
