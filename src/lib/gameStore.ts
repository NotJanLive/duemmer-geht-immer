import { create } from 'zustand';
import { GameState, Player, GameMode, GamePhase } from '@/types/game';

interface GameStore {
  // Connection state
  connected: boolean;
  roomCode: string | null;
  playerId: string | null;
  sessionId: string | null;
  isAdmin: boolean;
  
  // Game state (synced from server)
  gameState: GameState | null;
  
  // Local UI state
  selectedAnswer: number | null;
  answerConfirmed: boolean;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setRoomCode: (code: string | null) => void;
  setPlayerId: (id: string | null) => void;
  setSessionId: (id: string) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setGameState: (state: GameState | null) => void;
  updatePlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setSelectedAnswer: (answer: number | null) => void;
  setAnswerConfirmed: (confirmed: boolean) => void;
  reset: () => void;
  
  // Computed helpers
  getCurrentPlayer: () => Player | null;
  getPlayersSortedByScore: () => Player[];
  getPlayersSortedAlphabetically: () => Player[];
  getCurrentModeState: () => unknown;
}

const initialState = {
  connected: false,
  roomCode: null,
  playerId: null,
  sessionId: null,
  isAdmin: false,
  gameState: null,
  selectedAnswer: null,
  answerConfirmed: false,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  
  setConnected: (connected) => set({ connected }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setPlayerId: (playerId) => set({ playerId }),
  setSessionId: (sessionId) => set({ sessionId }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setGameState: (gameState) => set({ gameState }),
  
  updatePlayer: (player) => set((state) => {
    if (!state.gameState) return state;
    const players = state.gameState.players.map((p) =>
      p.id === player.id ? player : p
    );
    if (!players.find((p) => p.id === player.id)) {
      players.push(player);
    }
    return {
      gameState: { ...state.gameState, players },
    };
  }),
  
  removePlayer: (playerId) => set((state) => {
    if (!state.gameState) return state;
    return {
      gameState: {
        ...state.gameState,
        players: state.gameState.players.filter((p) => p.id !== playerId),
      },
    };
  }),
  
  setSelectedAnswer: (selectedAnswer) => set({ selectedAnswer }),
  setAnswerConfirmed: (answerConfirmed) => set({ answerConfirmed }),
  
  reset: () => set(initialState),
  
  getCurrentPlayer: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return null;
    return gameState.players.find((p) => p.id === playerId) || null;
  },
  
  getPlayersSortedByScore: () => {
    const { gameState } = get();
    if (!gameState) return [];
    return [...gameState.players].sort((a, b) => b.totalScore - a.totalScore);
  },
  
  getPlayersSortedAlphabetically: () => {
    const { gameState } = get();
    if (!gameState) return [];
    return [...gameState.players].sort((a, b) => 
      a.name.localeCompare(b.name, 'de')
    );
  },
  
  getCurrentModeState: () => {
    const { gameState } = get();
    if (!gameState) return null;
    switch (gameState.currentMode) {
      case 'lastManStanding':
        return gameState.lastManStanding;
      case 'millionaire':
        return gameState.millionaire;
      case 'higherLower':
        return gameState.higherLower;
      case 'jeopardy':
        return gameState.jeopardy;
      default:
        return null;
    }
  },
}));
