import { ReactNode } from 'react';
import { create } from 'zustand';
import { GameState, LiveInfo, Player, Role } from '@/types/game';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

interface RoomStore {
  state: GameState | null;
  role: Role | null;
  playerId: string | null;
  status: ConnectionStatus;
  clockOffset: number; // server time minus local time
  closedMessage: string | null;
  live: LiveInfo | null;
}

export const useRoomStore = create<RoomStore>(() => ({
  state: null,
  role: null,
  playerId: null,
  status: 'connecting',
  clockOffset: 0,
  closedMessage: null,
  live: null,
}));

export const useGame = () => useRoomStore((s) => s.state!);
export const usePlayerId = () => useRoomStore((s) => s.playerId);

// What the current mode says about each player (turn, right/wrong, a note).
// Modes publish it through <Scoreboard>, the cam tiles show it.
export interface PlayerBoard {
  turnId?: string | null;
  dimmed?: (p: Player) => boolean;
  tone?: (p: Player) => 'good' | 'bad' | null;
  note?: (p: Player) => ReactNode; // host list only
  tag?: (p: Player) => ReactNode; // next to the name (lock, check, hearts)
  score?: (p: Player) => number; // points to show instead of modeScore (reveal animations)
}

export const useBoardStore = create<{ board: PlayerBoard | null }>(() => ({ board: null }));

// The current mode's "Runde 2 von 5" line, shown in the top bar.
export const useHeaderStore = create<{ info: string | null }>(() => ({ info: null }));
