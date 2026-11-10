import { Show } from './show';
import { ShowRecord, addShow } from './db';
import { emptyTally } from '../src/types/stats';

// Called once when the show reaches the finale: totals are final then.
export function recordShow(show: Show): ShowRecord {
  const { game } = show;
  const sorted = [...game.players].sort((a, b) => b.totalScore - a.totalScore);
  const placeOf = (score: number) => sorted.findIndex((p) => p.totalScore === score) + 1;
  const top = sorted[0]?.totalScore ?? 0;

  const record: ShowRecord = {
    id: show.id,
    hostId: show.host.id,
    startedAt: show.startedAt,
    endedAt: Date.now(),
    plan: [...game.plan],
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      total: p.totalScore,
      place: placeOf(p.totalScore),
      modes: Object.fromEntries(
        Object.entries(game.modePoints).map(([mode, scores]) => [mode, scores?.[p.id] ?? 0]),
      ),
      tally: game.tally[p.id] ?? emptyTally(),
    })),
    winners: sorted.length && top > 0 ? sorted.filter((p) => p.totalScore === top).map((p) => p.id) : [],
    awarded: false,
  };
  addShow(record);
  return record;
}

// The finale counts every distinct score up for 7 s (see Finale.tsx), so the
// bot waits until the winner is on screen before it touches Discord.
export function finaleDurationMs(show: Show): number {
  return new Set(show.game.players.map((p) => p.totalScore)).size * 7000 + 3000;
}
