// Game Types for "Dümmer geht Immer"

export interface Player {
  id: string;
  name: string;
  sessionId: string;
  connected: boolean;
  totalScore: number;
  currentModeScore: number;
  // Last Man Standing
  lmsEliminated: boolean;
  // Higher or Lower
  holLives: number;
  // Jeopardy
  canBuzz: boolean;
  hasBuzzed: boolean;
}

export interface Card {
  id: string;
  value: string;
  revealed: boolean;
  revealedBy?: string;
}

export interface LastManStandingRound {
  topic: string;
  cards: Card[];
  currentPlayerIndex: number;
  eliminatedPlayers: string[];
  roundComplete: boolean;
}

export interface LastManStandingState {
  currentRound: number;
  totalRounds: number;
  rounds: LastManStandingRound[];
  roundScores: Record<string, number>;
}

export interface MillionaireQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  points: number;
  difficulty: number;
}

export interface MillionaireState {
  currentQuestionIndex: number;
  questions: MillionaireQuestion[];
  playerAnswers: Record<string, { answer: number | null; confirmed: boolean; correct?: boolean }>;
  showingResults: boolean;
  timeRemaining: number;
}

export interface HigherLowerItem {
  id: string;
  label: string;
  value: number;
  revealed: boolean;
  position?: number;
  isInitial?: boolean;
}

export interface HigherLowerRound {
  topic: string;
  unit: string;
  items: HigherLowerItem[];
  placedItems: HigherLowerItem[];
  currentPlayerIndex: number;
  currentItem?: HigherLowerItem;
}

export interface HigherLowerState {
  currentRound: number;
  totalRounds: number;
  rounds: HigherLowerRound[];
  playerLives: Record<string, number>;
  roundScores: Record<string, number>;
}

export interface JeopardyCategory {
  name: string;
  questions: JeopardyQuestion[];
}

export interface JeopardyQuestion {
  id: string;
  question: string;
  answer: string;
  points: number;
  originalPoints?: number;
  revealed: boolean;
  discarded?: boolean;
  answeredBy?: string;
}

export interface JeopardyState {
  categories: JeopardyCategory[];
  currentQuestion: JeopardyQuestion | null;
  currentPlayerIndex: number;
  buzzerOpen: boolean;
  buzzedPlayer: string | null;
  waitingForAnswer: boolean;
  openForAll: boolean;
}

export type GameMode = 'lobby' | 'lastManStanding' | 'millionaire' | 'higherLower' | 'jeopardy' | 'leaderboard' | 'finale';

export type GamePhase = 'waiting' | 'playing' | 'results' | 'transition';

export interface GameState {
  roomCode: string;
  adminId: string;
  players: Player[];
  currentMode: GameMode;
  phase: GamePhase;
  modeIndex: number;
  
  // Mode-specific states
  lastManStanding: LastManStandingState | null;
  millionaire: MillionaireState | null;
  higherLower: HigherLowerState | null;
  jeopardy: JeopardyState | null;
  
  // Finale
  finaleRevealed: string[];
  finaleStartTime: number | null;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
}

export interface Room {
  code: string;
  gameState: GameState;
  sessions: Map<string, string>; // sessionId -> playerId
}

// Socket Events
export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  playerJoined: (player: Player) => void;
  playerLeft: (playerId: string) => void;
  playerReconnected: (playerId: string) => void;
  buzzerPressed: (playerId: string) => void;
  finaleAnimationStarted: () => void;
  timerUpdate: (time: number) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  createRoom: (adminName: string, callback: (response: { success: boolean; roomCode?: string; sessionId?: string; error?: string }) => void) => void;
  joinRoom: (roomCode: string, playerName: string, sessionId: string, callback: (response: { success: boolean; playerId?: string; error?: string }) => void) => void;
  rejoinRoom: (roomCode: string, sessionId: string, callback: (response: { success: boolean; playerId?: string; gameState?: GameState; error?: string }) => void) => void;
  
  // Admin actions
  startGame: () => void;
  nextStep: () => void;
  previousStep: () => void;
  showLeaderboard: () => void;
  startFinale: () => void;
  startFinaleAnimation: () => void;
  closeRoom: () => void;
  revealNextFinalist: () => void;
  
  // LMS actions
  revealCard: (cardId: string) => void;
  eliminatePlayer: (playerId: string) => void;
  nextLmsRound: () => void;
  
  // Millionaire actions
  submitAnswer: (questionId: string, answer: number) => void;
  confirmAnswer: () => void;
  showMillionaireResults: () => void;
  nextQuestion: () => void;
  
  // Higher Lower actions
  holPlaceItem: (itemId: string, position?: number) => void;
  holRemoveItem: (itemId: string) => void;
  holTakeLife: (playerId: string) => void;
  holAddLife: (playerId: string) => void;
  holNextPlayer: () => void;
  holAwardPoints: (playerId: string, points: number) => void;
  holRemovePoints: (playerId: string, points: number) => void;
  holNextRound: () => void;
  
  // Jeopardy actions
  selectCategory: (categoryIndex: number, questionIndex: number) => void;
  openBuzzer: () => void;
  closeBuzzer: () => void;
  buzz: () => void;
  answerCorrect: (correct: boolean) => void;
  jeopardyDiscard: () => void;
  jeopardyResetBuzzer: () => void;
}
