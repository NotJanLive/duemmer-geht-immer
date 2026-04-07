import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { parse } from 'url';
import {
  GameState,
  Player,
  Room,
  GameMode,
  LastManStandingState,
  MillionaireState,
  HigherLowerState,
  JeopardyState,
  ClientToServerEvents,
  ServerToClientEvents,
} from './src/types/game';
import { v4 as uuidv4 } from 'uuid';
import { lmsData, millionaireData, higherLowerData, jeopardyData } from './src/lib/gameData';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port, turbo: false });
const handle = app.getRequestHandler();

// In-memory storage (replace with Redis for production)
const rooms = new Map<string, Room>();
const playerSockets = new Map<string, string>(); // socketId -> playerId
const socketRooms = new Map<string, string>(); // socketId -> roomCode

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Make sure code doesn't exist
  if (rooms.has(code)) {
    return generateRoomCode();
  }
  return code;
}

function createInitialGameState(roomCode: string, adminId: string): GameState {
  return {
    roomCode,
    adminId,
    players: [],
    currentMode: 'lobby',
    phase: 'waiting',
    modeIndex: 0,
    lastManStanding: null,
    millionaire: null,
    higherLower: null,
    jeopardy: null,
    finaleRevealed: [],
    finaleStartTime: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createPlayer(id: string, name: string, sessionId: string): Player {
  return {
    id,
    name,
    sessionId,
    connected: true,
    totalScore: 0,
    currentModeScore: 0,
    lmsEliminated: false,
    holLives: 2,
    canBuzz: true,
    hasBuzzed: false,
  };
}

function sortPlayersAlphabetically(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

function getNextPlayerIndex(players: Player[], currentIndex: number, excludeEliminated: boolean = false): number {
  const sorted = sortPlayersAlphabetically(players);
  let nextIndex = (currentIndex + 1) % sorted.length;
  
  if (excludeEliminated) {
    let attempts = 0;
    while (sorted[nextIndex].lmsEliminated && attempts < sorted.length) {
      nextIndex = (nextIndex + 1) % sorted.length;
      attempts++;
    }
  }
  
  return nextIndex;
}

// Sample data generators
function generateLMSRounds(): LastManStandingState {
  const rounds = lmsData.map((data, roundIdx) => ({
    topic: data.topic,
    cards: data.items.map((v, i) => ({ id: `lms-${roundIdx}-${i}`, value: v, revealed: false })),
  }));

  return {
    currentRound: 0,
    totalRounds: rounds.length,
    rounds: rounds.map(r => ({
      ...r,
      currentPlayerIndex: 0,
      eliminatedPlayers: [],
      roundComplete: false,
    })),
    roundScores: {},
  };
}

function generateMillionaireQuestions(): MillionaireState {
  const questions = millionaireData.map((q, i) => ({
    id: `wwm-${i}`,
    question: q.q,
    options: q.o,
    correctAnswer: q.a,
    points: Math.floor(i / 2) + 1,
    difficulty: Math.floor(i / 6) + 1,
  }));

  return {
    currentQuestionIndex: 0,
    questions,
    playerAnswers: {},
    showingResults: false,
    timeRemaining: 30,
  };
}

function generateHigherLowerRounds(): HigherLowerState {
  const rounds = higherLowerData.map((data, roundIdx) => {
    const items = data.items.map((item, i) => ({ id: `hol-${roundIdx}-${i}`, ...item, revealed: false, isInitial: false }));
    
    // Pick a random item to start with
    const startIndex = Math.floor(Math.random() * items.length);
    const startItem = { ...items[startIndex], revealed: true, isInitial: true };
    items[startIndex].revealed = true;
    items[startIndex].isInitial = true;
    
    return {
      topic: data.topic,
      unit: data.unit,
      items,
      placedItems: [startItem],
      currentPlayerIndex: 0,
      currentItem: undefined,
    };
  });

  return {
    currentRound: 0,
    totalRounds: rounds.length,
    rounds,
    playerLives: {},
    roundScores: {},
  };
}

function generateJeopardyCategories(): JeopardyState {
  return {
    categories: jeopardyData.map((cat, ci) => ({
      name: cat.name,
      questions: cat.questions.map((q, qi) => ({
        id: `jeo-${ci}-${qi}`,
        question: q.q,
        answer: q.a,
        points: (qi + 1) * 10,
        revealed: false,
      })),
    })),
    currentQuestion: null,
    currentPlayerIndex: 0,
    buzzerOpen: false,
    buzzedPlayer: null,
    waitingForAnswer: false,
    openForAll: false,
  };
}

function getOptimizedGameState(state: GameState): GameState {
  // Deep clone to avoid mutating original
  const optimized = JSON.parse(JSON.stringify(state));
  
  // Only keep the data for the current mode to save bandwidth
  if (optimized.currentMode !== 'lastManStanding') optimized.lastManStanding = null;
  if (optimized.currentMode !== 'millionaire') optimized.millionaire = null;
  if (optimized.currentMode !== 'higherLower') optimized.higherLower = null;
  if (optimized.currentMode !== 'jeopardy') optimized.jeopardy = null;
  
  // Further optimization: In Jeopardy, only send questions if they are revealed or current
  if (optimized.currentMode === 'jeopardy' && optimized.jeopardy) {
    optimized.jeopardy.categories.forEach((cat: any) => {
      cat.questions.forEach((q: any) => {
        if (!q.revealed && q.id !== optimized.jeopardy.currentQuestion?.id) {
          // Remove sensitive/large answer data for hidden questions
          delete q.answer; 
          delete q.question;
        }
      });
    });
  }

  return optimized;
}

function emitGameState(io: Server, roomCode: string, state: GameState) {
  const optimized = getOptimizedGameState(state);
  io.to(roomCode).emit('gameState', optimized);
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket'], // Prefer WebSockets for low latency
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Create Room (Admin)
    socket.on('createRoom', (adminName, callback) => {
      const roomCode = generateRoomCode();
      const adminId = uuidv4();
      const sessionId = uuidv4();
      
      const gameState = createInitialGameState(roomCode, adminId);
      // Admin is NOT a player - they are the game master
      // Store admin name and session for reconnect
      (gameState as any).adminName = adminName;
      (gameState as any).adminSessionId = sessionId;
      
      const room: Room = {
        code: roomCode,
        gameState,
        sessions: new Map([[sessionId, adminId]]),
      };
      
      rooms.set(roomCode, room);
      playerSockets.set(socket.id, adminId);
      socketRooms.set(socket.id, roomCode);
      
      socket.join(roomCode);
      
      // Also store the session mapping
      room.sessions.set(sessionId, adminId);
      
      callback({ success: true, roomCode, sessionId });
      socket.emit('gameState', gameState);
    });

    // Join Room (Player)
    socket.on('joinRoom', (roomCode, playerName, sessionId, callback) => {
      const room = rooms.get(roomCode.toUpperCase());
      
      if (!room) {
        callback({ success: false, error: 'Raum nicht gefunden' });
        return;
      }
      
      if (room.gameState.currentMode !== 'lobby') {
        // Check if this is a reconnect
        const existingPlayerId = room.sessions.get(sessionId);
        if (existingPlayerId) {
          const player = room.gameState.players.find(p => p.id === existingPlayerId);
          if (player) {
            player.connected = true;
            playerSockets.set(socket.id, existingPlayerId);
            socketRooms.set(socket.id, roomCode);
            socket.join(roomCode);
            
            callback({ success: true, playerId: existingPlayerId });
            emitGameState(io, roomCode, room.gameState);
            io.to(roomCode).emit('playerReconnected', existingPlayerId);
            return;
          }
        }
        callback({ success: false, error: 'Spiel läuft bereits' });
        return;
      }
      
      const playerId = uuidv4();
      const player = createPlayer(playerId, playerName, sessionId);
      
      room.gameState.players.push(player);
      room.sessions.set(sessionId, playerId);
      room.gameState.updatedAt = Date.now();
      
      playerSockets.set(socket.id, playerId);
      socketRooms.set(socket.id, roomCode);
      
      socket.join(roomCode);
      
      callback({ success: true, playerId });
      emitGameState(io, roomCode, room.gameState);
      io.to(roomCode).emit('playerJoined', player);
    });

    // Rejoin Room (Reconnect)
    socket.on('rejoinRoom', (roomCode, sessionId, callback) => {
      const room = rooms.get(roomCode.toUpperCase());
      
      if (!room) {
        callback({ success: false, error: 'Raum nicht gefunden' });
        return;
      }
      
      // Check if this is the admin reconnecting
      const adminSessionId = (room.gameState as any).adminSessionId;
      if (sessionId === adminSessionId || room.sessions.get(sessionId) === room.gameState.adminId) {
        // Admin reconnect
        playerSockets.set(socket.id, room.gameState.adminId);
        socketRooms.set(socket.id, roomCode.toUpperCase());
        socket.join(roomCode.toUpperCase());
        
        // Make sure session is stored
        room.sessions.set(sessionId, room.gameState.adminId);
        
        callback({ success: true, playerId: room.gameState.adminId, gameState: room.gameState });
        socket.emit('gameState', room.gameState);
        return;
      }
      
      const playerId = room.sessions.get(sessionId);
      if (!playerId) {
        callback({ success: false, error: 'Session nicht gefunden' });
        return;
      }
      
      const player = room.gameState.players.find(p => p.id === playerId);
      if (!player) {
        callback({ success: false, error: 'Spieler nicht gefunden' });
        return;
      }
      
      player.connected = true;
      playerSockets.set(socket.id, playerId);
      socketRooms.set(socket.id, roomCode.toUpperCase());
      
      socket.join(roomCode.toUpperCase());
      
      callback({ success: true, playerId, gameState: room.gameState });
      io.to(roomCode.toUpperCase()).emit('playerReconnected', playerId);
      io.to(roomCode.toUpperCase()).emit('gameState', room.gameState);
    });

    // Admin: Start Game
    socket.on('startGame', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      // Initialize all game modes
      room.gameState.lastManStanding = generateLMSRounds();
      room.gameState.millionaire = generateMillionaireQuestions();
      room.gameState.higherLower = generateHigherLowerRounds();
      room.gameState.jeopardy = generateJeopardyCategories();
      
      // Initialize player lives for Higher or Lower
      room.gameState.players.forEach(p => {
        room.gameState.higherLower!.playerLives[p.id] = 2;
      });
      
      room.gameState.currentMode = 'lastManStanding';
      room.gameState.phase = 'playing';
      room.gameState.modeIndex = 0;
      room.gameState.updatedAt = Date.now();
      
      emitGameState(io, roomCode, room.gameState);
    });

    // Admin: Show Leaderboard
    socket.on('showLeaderboard', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      // If we are coming from LMS, award points to survivors
      if (room.gameState.currentMode === 'lastManStanding' && room.gameState.lastManStanding) {
        const lms = room.gameState.lastManStanding;
        const currentRound = lms.rounds[lms.currentRound];
        const survivorPoints = currentRound.eliminatedPlayers.length + 1;
        const survivors = room.gameState.players.filter(
          p => !currentRound.eliminatedPlayers.includes(p.id)
        );
        survivors.forEach(p => {
          p.currentModeScore += survivorPoints;
        });
      }

      // DO NOT transfer current mode scores to total here anymore
      // This will be done in nextStep when moving to the next game
      
      room.gameState.currentMode = 'leaderboard';
      room.gameState.phase = 'results';
      room.gameState.updatedAt = Date.now();
      
      emitGameState(io, roomCode, room.gameState);
    });

    // Admin: Next Step
    socket.on('nextStep', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const modes: GameMode[] = ['lastManStanding', 'millionaire', 'higherLower', 'jeopardy'];
      
      if (room.gameState.currentMode === 'leaderboard') {
        // Transfer current mode scores to total and reset BEFORE moving to next mode
        room.gameState.players.forEach(p => {
          p.totalScore += p.currentModeScore;
          p.currentModeScore = 0;
        });

        // Move to next game mode
        room.gameState.modeIndex++;
        if (room.gameState.modeIndex < modes.length) {
          room.gameState.currentMode = modes[room.gameState.modeIndex];
          room.gameState.phase = 'playing';
          
          // Reset player states for new mode
          room.gameState.players.forEach(p => {
            p.lmsEliminated = false;
            p.holLives = 2;
            p.canBuzz = true;
            p.hasBuzzed = false;
          });
        } else {
          room.gameState.currentMode = 'finale';
          room.gameState.phase = 'playing';
        }
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Admin: Start Finale
    socket.on('startFinale', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      // Transfer current mode scores to total and reset BEFORE moving to finale
      room.gameState.players.forEach(p => {
        p.totalScore += p.currentModeScore;
        p.currentModeScore = 0;
      });

      room.gameState.currentMode = 'finale';
      room.gameState.phase = 'playing';
      room.gameState.finaleRevealed = [];
      room.gameState.finaleStartTime = null;
      room.gameState.updatedAt = Date.now();
      
      emitGameState(io, roomCode, room.gameState);
    });

    // Admin: Reveal Next Finalist
    socket.on('revealNextFinalist', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const sortedPlayers = [...room.gameState.players].sort((a, b) => a.totalScore - b.totalScore);
      const unrevealed = sortedPlayers.filter(p => !room.gameState.finaleRevealed.includes(p.id));
      
      if (unrevealed.length > 0) {
        room.gameState.finaleRevealed.push(unrevealed[0].id);
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Admin: Start Finale Animation
    socket.on('startFinaleAnimation', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      room.gameState.finaleStartTime = Date.now();
      room.gameState.updatedAt = Date.now();
      
      emitGameState(io, roomCode, room.gameState);
      io.to(roomCode).emit('finaleAnimationStarted');
    });

    // Admin: Close Room
    socket.on('closeRoom', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      // Notify all players to go home
      io.to(roomCode).emit('error', 'Die Sitzung wurde vom Spielleiter beendet.');
      
      // Delete the room
      rooms.delete(roomCode);
    });

    // LMS: Admin reveals a card by clicking on it
    socket.on('revealCard', (cardId) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.lastManStanding) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const lms = room.gameState.lastManStanding;
      const currentRound = lms.rounds[lms.currentRound];
      
      const card = currentRound.cards.find(c => c.id === cardId);
      if (card && !card.revealed) {
        card.revealed = true;
        
        // SWITCH PLAYER: Increment index to next active player (sorted alphabetically)
        const activePlayers = sortPlayersAlphabetically(room.gameState.players).filter(
          p => !currentRound.eliminatedPlayers.includes(p.id)
        );
        if (activePlayers.length > 0) {
          currentRound.currentPlayerIndex = (currentRound.currentPlayerIndex + 1) % activePlayers.length;
        }

        // Check if all cards revealed
        if (currentRound.cards.every(c => c.revealed)) {
          currentRound.roundComplete = true;
        }
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // LMS: Toggle Eliminate Player - click again to undo
    socket.on('eliminatePlayer', (targetPlayerId) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.lastManStanding) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const lms = room.gameState.lastManStanding;
      const currentRound = lms.rounds[lms.currentRound];
      const player = room.gameState.players.find(p => p.id === targetPlayerId);
      if (!player) return;
      
      const elimIndex = currentRound.eliminatedPlayers.indexOf(targetPlayerId);
      
      if (elimIndex === -1) {
        // Eliminate: Award points based on elimination order
        const eliminationOrder = currentRound.eliminatedPlayers.length + 1;
        player.currentModeScore += eliminationOrder;
        player.lmsEliminated = true;
        currentRound.eliminatedPlayers.push(targetPlayerId);
        
        // Store the points awarded for potential undo
        if (!lms.roundScores[targetPlayerId]) {
          lms.roundScores[targetPlayerId] = 0;
        }
        lms.roundScores[targetPlayerId] = eliminationOrder;
      } else {
        // Undo elimination: Remove points and restore player
        const pointsToRemove = lms.roundScores[targetPlayerId] || 0;
        player.currentModeScore -= pointsToRemove;
        player.lmsEliminated = false;
        currentRound.eliminatedPlayers.splice(elimIndex, 1);
        delete lms.roundScores[targetPlayerId];
        
        // Recalculate points for players eliminated after this one
        // (they need to shift down by 1)
        for (let i = elimIndex; i < currentRound.eliminatedPlayers.length; i++) {
          const laterPlayerId = currentRound.eliminatedPlayers[i];
          const laterPlayer = room.gameState.players.find(p => p.id === laterPlayerId);
          if (laterPlayer && lms.roundScores[laterPlayerId]) {
            laterPlayer.currentModeScore -= 1;
            lms.roundScores[laterPlayerId] -= 1;
          }
        }
      }
      
      // Update round complete status
      const activePlayers = room.gameState.players.filter(
        p => !currentRound.eliminatedPlayers.includes(p.id)
      );
      currentRound.roundComplete = activePlayers.length === 0 || currentRound.cards.every(c => c.revealed);
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // LMS: Next Round - award survivors before moving on
    socket.on('nextLmsRound', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.lastManStanding) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const lms = room.gameState.lastManStanding;
      const currentRound = lms.rounds[lms.currentRound];
      
      // Award surviving players: 1 more point than the last eliminated
      const survivorPoints = currentRound.eliminatedPlayers.length + 1;
      const survivors = room.gameState.players.filter(
        p => !currentRound.eliminatedPlayers.includes(p.id)
      );
      survivors.forEach(p => {
        p.currentModeScore += survivorPoints;
      });
      
      if (lms.currentRound < lms.totalRounds - 1) {
        lms.currentRound++;
        // Reset elimination status and scores for new round
        lms.roundScores = {};
        room.gameState.players.forEach(p => {
          p.lmsEliminated = false;
        });
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Millionaire: Submit Answer
    socket.on('submitAnswer', (questionId, answer) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.millionaire) return;
      
      const playerId = playerSockets.get(socket.id);
      if (!playerId) return;
      
      const wwm = room.gameState.millionaire;
      
      if (!wwm.playerAnswers[playerId]) {
        wwm.playerAnswers[playerId] = { answer: null, confirmed: false };
      }
      
      wwm.playerAnswers[playerId].answer = answer;
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Millionaire: Confirm Answer
    socket.on('confirmAnswer', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.millionaire) return;
      
      const playerId = playerSockets.get(socket.id);
      if (!playerId) return;
      
      const wwm = room.gameState.millionaire;
      
      if (wwm.playerAnswers[playerId] && wwm.playerAnswers[playerId].answer !== null) {
        wwm.playerAnswers[playerId].confirmed = true;
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Millionaire: Show Results
    socket.on('showMillionaireResults', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.millionaire) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const wwm = room.gameState.millionaire;

      // Only award points if we're not already showing results
      if (!wwm.showingResults) {
        const currentQuestion = wwm.questions[wwm.currentQuestionIndex];
        
        // Evaluate answers
        Object.keys(wwm.playerAnswers).forEach(pId => {
          const playerAnswer = wwm.playerAnswers[pId];
          if (playerAnswer.confirmed && playerAnswer.answer === currentQuestion.correctAnswer) {
            playerAnswer.correct = true;
            const player = room.gameState.players.find(p => p.id === pId);
            if (player) {
              player.currentModeScore += currentQuestion.points;
            }
          } else {
            playerAnswer.correct = false;
          }
        });
        
        wwm.showingResults = true;
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Millionaire: Next Question
    socket.on('nextQuestion', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.millionaire) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const wwm = room.gameState.millionaire;
      
      if (wwm.currentQuestionIndex < wwm.questions.length - 1) {
        wwm.currentQuestionIndex++;
        wwm.playerAnswers = {};
        wwm.showingResults = false;
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Higher Lower: Admin places item on scale
    socket.on('holPlaceItem', (itemId, position) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.higherLower) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const hol = room.gameState.higherLower;
      const currentRound = hol.rounds[hol.currentRound];
      
      // Find item in available items
      const itemIndex = currentRound.items.findIndex(i => i.id === itemId && !i.revealed);
      if (itemIndex === -1) return;
      
      const item = currentRound.items[itemIndex];
      item.revealed = true;
      
      // If no position provided or just for safety, find correct one automatically based on values
      let targetPosition = 0;
      // Sort existing items by value first to ensure consistent index finding
      const currentPlaced = [...currentRound.placedItems].sort((a, b) => a.value - b.value);
      
      for (let i = 0; i < currentPlaced.length; i++) {
        if (item.value > currentPlaced[i].value) {
          targetPosition = i + 1;
        } else {
          break;
        }
      }
      
      // Now find where that translates to in the actual currentRound.placedItems 
      // Actually, it's easier to just rebuild currentRound.placedItems sorted by value
      currentRound.placedItems.push(item);
      currentRound.placedItems.sort((a, b) => a.value - b.value);
      
      // Set position for metadata (though we sort dynamically usually)
      item.position = currentRound.placedItems.indexOf(item);
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Higher Lower: Admin removes item from scale
    socket.on('holRemoveItem', (itemId) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.higherLower) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const hol = room.gameState.higherLower;
      const currentRound = hol.rounds[hol.currentRound];
      
      // Find and remove from placed items
      const placedIndex = currentRound.placedItems.findIndex(i => i.id === itemId);
      if (placedIndex !== -1) {
        const item = currentRound.placedItems[placedIndex];
        // Cannot remove initial item
        if (item.isInitial) return;

        item.revealed = false;
        item.position = undefined;
        currentRound.placedItems.splice(placedIndex, 1);
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Higher Lower: Admin takes life from player
    socket.on('holTakeLife', (targetPlayerId) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.higherLower) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const hol = room.gameState.higherLower;
      
      if (hol.playerLives[targetPlayerId] > 0) {
        hol.playerLives[targetPlayerId]--;
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Higher Lower: Admin adds life to player
    socket.on('holAddLife', (targetPlayerId) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.higherLower) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const hol = room.gameState.higherLower;
      
      if (hol.playerLives[targetPlayerId] < 2) {
        hol.playerLives[targetPlayerId]++;
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Higher Lower: Admin removes points from player
    socket.on('holRemovePoints', (targetPlayerId, points) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.higherLower) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const player = room.gameState.players.find(p => p.id === targetPlayerId);
      if (player) {
        player.currentModeScore = Math.max(0, player.currentModeScore - points);
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Higher Lower: Admin moves to next player
    socket.on('holNextPlayer', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.higherLower) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const hol = room.gameState.higherLower;
      const currentRound = hol.rounds[hol.currentRound];
      const sorted = sortPlayersAlphabetically(room.gameState.players);
      
      currentRound.currentPlayerIndex = (currentRound.currentPlayerIndex + 1) % sorted.length;
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Higher Lower: Admin awards points
    socket.on('holAwardPoints', (targetPlayerId, points) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.higherLower) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const player = room.gameState.players.find(p => p.id === targetPlayerId);
      if (player) {
        player.currentModeScore += points;
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Higher Lower: Next round
    socket.on('holNextRound', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.higherLower) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      const hol = room.gameState.higherLower;
      
      if (hol.currentRound < hol.totalRounds - 1) {
        hol.currentRound++;
        // Reset lives for new round
        room.gameState.players.forEach(p => {
          hol.playerLives[p.id] = 2;
        });
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Jeopardy: Select Category - selecting player answers first without buzzer
    socket.on('selectCategory', (categoryIndex, questionIndex) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.jeopardy) return;
      
      const jeo = room.gameState.jeopardy;
      const question = jeo.categories[categoryIndex].questions[questionIndex];
      
      if (!question.revealed) {
        jeo.currentQuestion = { ...question, originalPoints: question.points };
        jeo.waitingForAnswer = true;
        jeo.buzzerOpen = false;
        jeo.buzzedPlayer = null;
        jeo.openForAll = false;
        
        // Reset buzz tracking for ALL players for this question
        room.gameState.players.forEach(p => {
          p.canBuzz = true;
          p.hasBuzzed = false;
        });

        // The selecting player gets first attempt without buzzer
        const sorted = sortPlayersAlphabetically(room.gameState.players);
        const selectingPlayer = sorted[jeo.currentPlayerIndex % sorted.length];
        
        if (selectingPlayer) {
          jeo.buzzedPlayer = selectingPlayer.id;
          // Selecting player has "used" their first try
          selectingPlayer.hasBuzzed = true;
        }
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Jeopardy: Open Buzzer
    socket.on('openBuzzer', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.jeopardy) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      room.gameState.jeopardy.buzzerOpen = true;
      room.gameState.jeopardy.buzzedPlayer = null;
      
      // Reset buzz state for all players
      room.gameState.players.forEach(p => {
        p.hasBuzzed = false;
        p.canBuzz = true;
      });
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Jeopardy: Close Buzzer
    socket.on('closeBuzzer', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.jeopardy) return;
      
      const playerId = playerSockets.get(socket.id);
      if (playerId !== room.gameState.adminId) return;
      
      room.gameState.jeopardy.buzzerOpen = false;
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Jeopardy: Buzz
    socket.on('buzz', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.jeopardy) return;
      
      const playerId = playerSockets.get(socket.id);
      if (!playerId) return;
      
      const jeo = room.gameState.jeopardy;
      
      // STRENGERE PRÜFUNG: Nur wenn Buzzer offen UND noch kein Spieler registriert ist
      if (jeo.buzzerOpen === true && jeo.buzzedPlayer === null) {
        const player = room.gameState.players.find(p => p.id === playerId);
        if (!player || !player.canBuzz) return;

        // Sofort sperren, bevor irgendetwas anderes passiert
        jeo.buzzerOpen = false;
        jeo.buzzedPlayer = playerId;
        player.hasBuzzed = true;
        
        room.gameState.updatedAt = Date.now();
        emitGameState(io, roomCode, room.gameState);
        io.to(roomCode).emit('buzzerPressed', playerId);
      }
    });

    // Jeopardy: Answer Correct
    socket.on('answerCorrect', (correct) => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.jeopardy) return;
      
      const adminPlayerId = playerSockets.get(socket.id);
      if (adminPlayerId !== room.gameState.adminId) return;
      
      const jeo = room.gameState.jeopardy;
      
      if (jeo.currentQuestion && jeo.buzzedPlayer) {
        const player = room.gameState.players.find(p => p.id === jeo.buzzedPlayer);
        const sorted = sortPlayersAlphabetically(room.gameState.players);
        const selectingPlayer = sorted[jeo.currentPlayerIndex % sorted.length];
        const isSelectingPlayer = jeo.buzzedPlayer === selectingPlayer?.id && !jeo.openForAll;
        
        if (correct && player) {
          // Award current points (which might have been halved already)
          player.currentModeScore += jeo.currentQuestion.points;
          
          // Mark question as answered in the actual category
          const catIndex = jeo.categories.findIndex(c => 
            c.questions.some(q => q.id === jeo.currentQuestion!.id)
          );
          if (catIndex !== -1) {
            const qIndex = jeo.categories[catIndex].questions.findIndex(q => q.id === jeo.currentQuestion!.id);
            if (qIndex !== -1) {
              jeo.categories[catIndex].questions[qIndex].revealed = true;
              jeo.categories[catIndex].questions[qIndex].answeredBy = player.id;
            }
          }
          
          jeo.currentQuestion = null;
          jeo.waitingForAnswer = false;
          jeo.openForAll = false;
          jeo.buzzerOpen = false;
          jeo.buzzedPlayer = null;
          
          // Move to next player for selection
          jeo.currentPlayerIndex = (jeo.currentPlayerIndex + 1) % sorted.length;
        } else {
          // Wrong answer - this player can't buzz again for this question (for now)
          if (player) {
            player.canBuzz = false;
            player.hasBuzzed = true; // Mark as having tried
          }

          // IF this was the first answer (selecting player), halve the points
          if (!jeo.openForAll && jeo.currentQuestion) {
            // Keep track of original points for display, but reduce the current value
            if (!jeo.currentQuestion.originalPoints) {
              jeo.currentQuestion.originalPoints = jeo.currentQuestion.points;
            }
            jeo.currentQuestion.points = Math.floor(jeo.currentQuestion.points / 2);
          }

          jeo.buzzedPlayer = null;
          
          // Check if there are players left who haven't tried at all
          const canStillBuzz = room.gameState.players.filter(p => p.canBuzz && !p.hasBuzzed);
          
          if (canStillBuzz.length > 0) {
            // Open buzzer for remaining players
            jeo.openForAll = true;
            jeo.buzzerOpen = true;
            jeo.waitingForAnswer = false;
          } else {
            // EVERYONE has tried and failed at least once -> RESET for all
            room.gameState.players.forEach(p => {
              p.canBuzz = true;
              p.hasBuzzed = false;
            });
            jeo.buzzerOpen = true;
            jeo.openForAll = true;
            jeo.waitingForAnswer = false;
            jeo.buzzedPlayer = null;
          }
        }
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Jeopardy: Discard question (no one knows answer)
    socket.on('jeopardyDiscard', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.jeopardy) return;
      
      const adminPlayerId = playerSockets.get(socket.id);
      if (adminPlayerId !== room.gameState.adminId) return;
      
      const jeo = room.gameState.jeopardy;
      
      if (jeo.currentQuestion) {
        // Mark question as revealed but unanswered
        const catIndex = jeo.categories.findIndex(c => 
          c.questions.some(q => q.id === jeo.currentQuestion!.id)
        );
        if (catIndex !== -1) {
          const qIndex = jeo.categories[catIndex].questions.findIndex(q => q.id === jeo.currentQuestion!.id);
          if (qIndex !== -1) {
            jeo.categories[catIndex].questions[qIndex].revealed = true;
            jeo.categories[catIndex].questions[qIndex].discarded = true; // Mark as discarded
          }
        }
        
        jeo.currentQuestion = null;
        jeo.waitingForAnswer = false;
        jeo.openForAll = false;
        jeo.buzzerOpen = false;
        jeo.buzzedPlayer = null;
        
        // Move to next player
        const sorted = sortPlayersAlphabetically(room.gameState.players);
        jeo.currentPlayerIndex = (jeo.currentPlayerIndex + 1) % sorted.length;
      }
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Jeopardy: Reset buzzer for all players
    socket.on('jeopardyResetBuzzer', () => {
      const roomCode = socketRooms.get(socket.id);
      if (!roomCode) return;
      
      const room = rooms.get(roomCode);
      if (!room || !room.gameState.jeopardy) return;
      
      const adminPlayerId = playerSockets.get(socket.id);
      if (adminPlayerId !== room.gameState.adminId) return;
      
      // Reset all players' buzz state
      room.gameState.players.forEach(p => {
        p.canBuzz = true;
        p.hasBuzzed = false;
      });
      
      room.gameState.jeopardy.buzzerOpen = true;
      room.gameState.jeopardy.buzzedPlayer = null;
      room.gameState.jeopardy.openForAll = true; // Ensure UI shows buzzer
      room.gameState.jeopardy.waitingForAnswer = false; // We are waiting for buzz now
      
      room.gameState.updatedAt = Date.now();
      emitGameState(io, roomCode, room.gameState);
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      const playerId = playerSockets.get(socket.id);
      const roomCode = socketRooms.get(socket.id);
      
      if (playerId && roomCode) {
        const room = rooms.get(roomCode);
        if (room) {
          const player = room.gameState.players.find(p => p.id === playerId);
          if (player) {
            player.connected = false;
            io.to(roomCode).emit('playerLeft', playerId);
            emitGameState(io, roomCode, room.gameState);
          }
        }
      }
      
      playerSockets.delete(socket.id);
      socketRooms.delete(socket.id);
      
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

function checkHigherLowerPlacement(placedItems: { value: number }[], newItem: { value: number }, position: number): boolean {
  if (placedItems.length === 0) return true;
  
  const before = position > 0 ? placedItems[position - 1] : null;
  const after = position < placedItems.length ? placedItems[position] : null;
  
  if (before && newItem.value < before.value) return false;
  if (after && newItem.value > after.value) return false;
  
  return true;
}
