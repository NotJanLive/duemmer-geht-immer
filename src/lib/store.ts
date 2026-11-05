import { create } from 'zustand';
import { GameState, Role } from '@/types/game';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

interface RoomStore {
  state: GameState | null;
  role: Role | null;
  playerId: string | null;
  status: ConnectionStatus;
  clockOffset: number; // server time minus local time
  closedMessage: string | null;
}

export const useRoomStore = create<RoomStore>(() => ({
  state: null,
  role: null,
  playerId: null,
  status: 'connecting',
  clockOffset: 0,
  closedMessage: null,
}));

export const useGame = () => useRoomStore((s) => s.state!);
export const usePlayerId = () => useRoomStore((s) => s.playerId);
