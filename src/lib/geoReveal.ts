import { GameState, Player } from '@/types/game';

// Timeline of the Wo liegt das? reveal, shared by the map screen and the cam
// tiles so both hold back the new points until each player's line is done.
// Farthest pin first; everything is timed from the server's reveal time.
export const GEO_INTRO_MS = 1400;
export const GEO_BACK_MS = 600;
export const GEO_LINE_MS = 1900;
export const GEO_HOLD_MS = 1200;
export const GEO_STEP_MS = GEO_BACK_MS + GEO_LINE_MS + GEO_HOLD_MS;

export function geoTimeline(state: GameState, now: number) {
  const geo = state.geo!;
  const guessed = state.players.filter((p) => geo.guesses[p.id]);
  const sequence = [...guessed].sort((a, b) => (geo.results[b.id]?.distanceKm ?? 0) - (geo.results[a.id]?.distanceKm ?? 0));
  const animating = geo.revealed && geo.revealedAt !== null;
  const elapsed = animating ? now - geo.revealedAt! : Infinity;
  const done = elapsed >= GEO_INTRO_MS + sequence.length * GEO_STEP_MS;
  const stepAt = (i: number) => GEO_INTRO_MS + i * GEO_STEP_MS;
  // 0 = not started, 0..1 = line running, 1 = shown
  const progressOf = (id: string) => {
    const i = sequence.findIndex((p) => p.id === id);
    if (i === -1) return done ? 1 : 0;
    return Math.min(1, Math.max(0, (elapsed - stepAt(i) - GEO_BACK_MS) / GEO_LINE_MS));
  };
  const shown = (id: string) => progressOf(id) >= 1;
  const current = done ? -1 : Math.floor((elapsed - GEO_INTRO_MS) / GEO_STEP_MS);
  // Points of this place only count once the player's line is done.
  const score = (p: Player) => p.modeScore - (geo.results[p.id] && !shown(p.id) ? geo.results[p.id].points : 0);
  return { guessed, sequence, animating, elapsed, done, stepAt, progressOf, shown, current, score };
}
