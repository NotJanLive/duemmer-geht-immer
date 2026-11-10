import type { Mode } from './game';

// Counters collected per player during a show, summed over all shows.
export interface Tally {
  wwmSeen: number;
  wwmCorrect: number;
  geoGuesses: number;
  geoKm: number;
  picSolved: number;
  jeoCorrect: number;
  jeoWrong: number;
  songSeen: number;
  songSolved: number;
  songStages: number; // sum of the stage numbers (1..5) a song was solved at
}

export const emptyTally = (): Tally => ({
  wwmSeen: 0,
  wwmCorrect: 0,
  geoGuesses: 0,
  geoKm: 0,
  picSolved: 0,
  jeoCorrect: 0,
  jeoWrong: 0,
  songSeen: 0,
  songSolved: 0,
  songStages: 0,
});

export interface PlayerStats {
  id: string;
  name: string;
  avatar: string | null;
  shows: number;
  wins: number;
  podiums: number;
  points: number;
  bestTotal: number;
  avgPlace: number;
  places: Record<number, number>;
  modes: Partial<Record<Mode, { total: number; shows: number }>>;
  tally: Tally;
  history: { showId: string; endedAt: number; place: number; total: number; players: number }[];
}

export interface LeaderboardRow {
  id: string;
  name: string;
  avatar: string | null;
  shows: number;
  wins: number;
  podiums: number;
  points: number;
  avgPoints: number;
  avgPlace: number;
}

export interface ShowSummary {
  id: string;
  endedAt: number;
  plan: Mode[];
  players: { id: string; name: string; total: number; place: number; modes: Partial<Record<Mode, number>> }[];
}

export interface Me {
  id: string;
  name: string;
  avatar: string | null;
  isHost: boolean;
  overlayUrl?: string; // host only
}

export function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [value, sym] of table) {
    while (n >= value) {
      out += sym;
      n -= value;
    }
  }
  return out;
}

// "Jan [III]" -> "Jan"
export function stripWinTag(name: string): string {
  return name.replace(/\s*\[[IVXLCDM]+\]\s*$/, '').trim();
}
