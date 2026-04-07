"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const next_1 = __importDefault(require("next"));
const url_1 = require("url");
const uuid_1 = require("uuid");
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
// In-memory storage (replace with Redis for production)
const rooms = new Map();
const playerSockets = new Map(); // socketId -> playerId
const socketRooms = new Map(); // socketId -> roomCode
function generateRoomCode() {
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
function createInitialGameState(roomCode, adminId) {
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}
function createPlayer(id, name, sessionId) {
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
function sortPlayersAlphabetically(players) {
    return [...players].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
function getNextPlayerIndex(players, currentIndex, excludeEliminated = false) {
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
function generateLMSRounds() {
    const rounds = [
        {
            topic: 'Deutsche Bundesländer',
            cards: [
                'Bayern', 'Baden-Württemberg', 'Hessen', 'Nordrhein-Westfalen',
                'Niedersachsen', 'Sachsen', 'Berlin', 'Hamburg', 'Bremen',
                'Schleswig-Holstein', 'Rheinland-Pfalz', 'Saarland', 'Brandenburg',
                'Mecklenburg-Vorpommern', 'Thüringen', 'Sachsen-Anhalt'
            ].map((v, i) => ({ id: `lms-1-${i}`, value: v, revealed: false })),
        },
        {
            topic: 'Europäische Hauptstädte',
            cards: [
                'Berlin', 'Paris', 'London', 'Madrid', 'Rom', 'Wien', 'Amsterdam',
                'Brüssel', 'Lissabon', 'Athen', 'Warschau', 'Prag'
            ].map((v, i) => ({ id: `lms-2-${i}`, value: v, revealed: false })),
        },
        {
            topic: 'Marvel Superhelden',
            cards: [
                'Spider-Man', 'Iron Man', 'Captain America', 'Thor', 'Hulk',
                'Black Widow', 'Hawkeye', 'Doctor Strange', 'Black Panther',
                'Scarlet Witch', 'Ant-Man', 'Vision'
            ].map((v, i) => ({ id: `lms-3-${i}`, value: v, revealed: false })),
        },
        {
            topic: 'Automarken',
            cards: [
                'BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Porsche', 'Ford',
                'Toyota', 'Honda', 'Ferrari', 'Lamborghini', 'Tesla', 'Opel'
            ].map((v, i) => ({ id: `lms-4-${i}`, value: v, revealed: false })),
        },
        {
            topic: 'Obstsorten',
            cards: [
                'Apfel', 'Birne', 'Banane', 'Orange', 'Erdbeere', 'Kirsche',
                'Traube', 'Mango', 'Ananas', 'Wassermelone', 'Pfirsich', 'Kiwi'
            ].map((v, i) => ({ id: `lms-5-${i}`, value: v, revealed: false })),
        },
    ];
    return {
        currentRound: 0,
        totalRounds: 5,
        rounds: rounds.map(r => ({
            ...r,
            currentPlayerIndex: 0,
            eliminatedPlayers: [],
            roundComplete: false,
        })),
        roundScores: {},
    };
}
function generateMillionaireQuestions() {
    const baseQuestions = [
        { q: 'Wie viele Bundesländer hat Deutschland?', o: ['14', '16', '18', '20'], a: 1 },
        { q: 'Welcher Planet ist der Sonne am nächsten?', o: ['Venus', 'Mars', 'Merkur', 'Erde'], a: 2 },
        { q: 'Wer malte die Mona Lisa?', o: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Donatello'], a: 1 },
        { q: 'In welchem Jahr fiel die Berliner Mauer?', o: ['1987', '1989', '1991', '1990'], a: 1 },
        { q: 'Wie heißt die Hauptstadt von Australien?', o: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], a: 2 },
        { q: 'Welches Element hat das chemische Symbol "Au"?', o: ['Silber', 'Gold', 'Kupfer', 'Aluminium'], a: 1 },
        { q: 'Wie viele Spieler hat eine Fußballmannschaft auf dem Feld?', o: ['10', '11', '12', '9'], a: 1 },
        { q: 'Wer schrieb "Romeo und Julia"?', o: ['Goethe', 'Shakespeare', 'Schiller', 'Dickens'], a: 1 },
        { q: 'Was ist die Quadratwurzel aus 144?', o: ['10', '11', '12', '14'], a: 2 },
        { q: 'Welches Land hat die meisten Einwohner?', o: ['USA', 'Indien', 'China', 'Russland'], a: 2 },
        { q: 'In welchem Jahr wurde das erste iPhone vorgestellt?', o: ['2005', '2006', '2007', '2008'], a: 2 },
        { q: 'Welcher Ozean ist der größte?', o: ['Atlantik', 'Indischer Ozean', 'Pazifik', 'Arktischer Ozean'], a: 2 },
        { q: 'Wie heißt der längste Fluss der Welt?', o: ['Amazonas', 'Nil', 'Donau', 'Mississippi'], a: 1 },
        { q: 'Welches Tier ist das schnellste an Land?', o: ['Löwe', 'Gepard', 'Pferd', 'Antilope'], a: 1 },
        { q: 'Wie viele Zähne hat ein erwachsener Mensch?', o: ['28', '30', '32', '34'], a: 2 },
        { q: 'Wer war der erste Mensch auf dem Mond?', o: ['Buzz Aldrin', 'Neil Armstrong', 'Michael Collins', 'Yuri Gagarin'], a: 1 },
        { q: 'Wie heißt das größte Organ des Menschen?', o: ['Leber', 'Herz', 'Haut', 'Lunge'], a: 2 },
        { q: 'In welcher Stadt steht der Eiffelturm?', o: ['London', 'Rom', 'Paris', 'Berlin'], a: 2 },
        { q: 'Welches Gas atmen Pflanzen ein?', o: ['Sauerstoff', 'Stickstoff', 'Kohlendioxid', 'Wasserstoff'], a: 2 },
        { q: 'Wie viele Kontinente gibt es?', o: ['5', '6', '7', '8'], a: 2 },
        { q: 'Welche Farbe hat Chlorophyll?', o: ['Rot', 'Blau', 'Grün', 'Gelb'], a: 2 },
        { q: 'Wer entwickelte die Relativitätstheorie?', o: ['Newton', 'Einstein', 'Hawking', 'Bohr'], a: 1 },
        { q: 'Wie heißt die Währung in Japan?', o: ['Yuan', 'Won', 'Yen', 'Rupie'], a: 2 },
        { q: 'Welches Land ist für die Pyramiden bekannt?', o: ['Mexiko', 'Ägypten', 'Peru', 'China'], a: 1 },
        { q: 'Was ist H2O?', o: ['Sauerstoff', 'Wasserstoff', 'Wasser', 'Helium'], a: 2 },
        { q: 'Wie viele Minuten hat eine Stunde?', o: ['30', '45', '60', '90'], a: 2 },
        { q: 'Welche Sportart wird bei Wimbledon gespielt?', o: ['Golf', 'Tennis', 'Cricket', 'Rugby'], a: 1 },
        { q: 'Wie heißt der höchste Berg der Welt?', o: ['K2', 'Mount Everest', 'Kilimandscharo', 'Mont Blanc'], a: 1 },
        { q: 'Welches Instrument hat 88 Tasten?', o: ['Gitarre', 'Klavier', 'Orgel', 'Akkordeon'], a: 1 },
        { q: 'In welchem Jahr begann der Zweite Weltkrieg?', o: ['1937', '1938', '1939', '1940'], a: 2 },
    ];
    const questions = baseQuestions.map((q, i) => ({
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
function generateHigherLowerRounds() {
    const roundsData = [
        {
            topic: 'Einwohnerzahl deutscher Städte',
            unit: 'Einwohner (Tausend)',
            items: [
                { label: 'Berlin', value: 3645 },
                { label: 'München', value: 1472 },
                { label: 'Hamburg', value: 1841 },
                { label: 'Frankfurt', value: 753 },
                { label: 'Stuttgart', value: 635 },
                { label: 'Düsseldorf', value: 619 },
                { label: 'Leipzig', value: 587 },
                { label: 'Dortmund', value: 588 },
            ].map((item, i) => ({ id: `hol-1-${i}`, ...item, revealed: false })),
        },
        {
            topic: 'Erscheinungsjahr von Filmen',
            unit: 'Jahr',
            items: [
                { label: 'Titanic', value: 1997 },
                { label: 'Avatar', value: 2009 },
                { label: 'Der Pate', value: 1972 },
                { label: 'Inception', value: 2010 },
                { label: 'Matrix', value: 1999 },
                { label: 'Forrest Gump', value: 1994 },
                { label: 'Pulp Fiction', value: 1994 },
                { label: 'Joker', value: 2019 },
            ].map((item, i) => ({ id: `hol-2-${i}`, ...item, revealed: false })),
        },
        {
            topic: 'Kalorien pro 100g',
            unit: 'kcal',
            items: [
                { label: 'Apfel', value: 52 },
                { label: 'Banane', value: 89 },
                { label: 'Schokolade', value: 546 },
                { label: 'Reis', value: 130 },
                { label: 'Hähnchenbrust', value: 165 },
                { label: 'Pommes', value: 312 },
                { label: 'Salat', value: 15 },
                { label: 'Pizza', value: 266 },
            ].map((item, i) => ({ id: `hol-3-${i}`, ...item, revealed: false })),
        },
    ];
    // Pre-place one item per round as starting reference
    const rounds = roundsData.map(r => {
        // Pick a random item to start with
        const startIndex = Math.floor(Math.random() * r.items.length);
        const startItem = { ...r.items[startIndex], revealed: true };
        r.items[startIndex].revealed = true;
        return {
            ...r,
            placedItems: [startItem],
            currentPlayerIndex: 0,
            currentItem: undefined,
        };
    });
    return {
        currentRound: 0,
        totalRounds: 3,
        rounds,
        playerLives: {},
        roundScores: {},
    };
}
function generateJeopardyCategories() {
    const categories = [
        {
            name: 'Geschichte',
            questions: [
                { q: 'In welchem Jahr wurde die Berliner Mauer gebaut?', a: '1961' },
                { q: 'Wer war der erste deutsche Bundeskanzler?', a: 'Konrad Adenauer' },
                { q: 'In welchem Jahr endete der Erste Weltkrieg?', a: '1918' },
                { q: 'Welcher römische Kaiser ließ den Limes bauen?', a: 'Hadrian' },
                { q: 'In welchem Jahr wurde das Deutsche Reich gegründet?', a: '1871' },
            ],
        },
        {
            name: 'Geographie',
            questions: [
                { q: 'Wie heißt der längste Fluss Deutschlands?', a: 'Rhein' },
                { q: 'Welches ist das kleinste Bundesland?', a: 'Bremen' },
                { q: 'An wie viele Länder grenzt Deutschland?', a: '9' },
                { q: 'Wie heißt der höchste Berg Deutschlands?', a: 'Zugspitze' },
                { q: 'Welche Stadt ist die nördlichste Landeshauptstadt?', a: 'Kiel' },
            ],
        },
        {
            name: 'Sport',
            questions: [
                { q: 'Wie oft wurde Deutschland Fußball-Weltmeister?', a: '4' },
                { q: 'In welcher Stadt fanden 1972 die Olympischen Spiele statt?', a: 'München' },
                { q: 'Wie heißt der erfolgreichste deutsche F1-Fahrer?', a: 'Michael Schumacher' },
                { q: 'Welcher Verein hat die meisten Bundesliga-Titel?', a: 'Bayern München' },
                { q: 'Wie lang ist ein Marathon in Kilometern?', a: '42,195 km' },
            ],
        },
        {
            name: 'Wissenschaft',
            questions: [
                { q: 'Welches chemische Element hat die Ordnungszahl 1?', a: 'Wasserstoff' },
                { q: 'Wie heißt die Einheit für elektrischen Widerstand?', a: 'Ohm' },
                { q: 'Welcher Planet hat die meisten Monde?', a: 'Saturn' },
                { q: 'Was bedeutet DNA ausgeschrieben?', a: 'Desoxyribonukleinsäure' },
                { q: 'Wie schnell ist Lichtgeschwindigkeit (gerundet)?', a: '300.000 km/s' },
            ],
        },
        {
            name: 'Unterhaltung',
            questions: [
                { q: 'Wer singt "99 Luftballons"?', a: 'Nena' },
                { q: 'Wie heißt der Zauberer bei Harry Potter mit Nachnamen?', a: 'Potter' },
                { q: 'Welche Band sang "Durch den Monsun"?', a: 'Tokio Hotel' },
                { q: 'Wie heißt die Hauptfigur in "Der Herr der Ringe"?', a: 'Frodo' },
                { q: 'Wer moderierte ursprünglich "Wetten, dass..?"?', a: 'Frank Elstner' },
            ],
        },
        {
            name: 'Essen & Trinken',
            questions: [
                { q: 'Aus welchem Land kommt Sushi?', a: 'Japan' },
                { q: 'Welches Getränk wird aus Hopfen hergestellt?', a: 'Bier' },
                { q: 'Was ist die Hauptzutat von Guacamole?', a: 'Avocado' },
                { q: 'Aus welcher Region kommt Champagner?', a: 'Champagne (Frankreich)' },
                { q: 'Welches Gewürz macht Essen scharf?', a: 'Chili / Capsaicin' },
            ],
        },
    ];
    return {
        categories: categories.map((cat, ci) => ({
            name: cat.name,
            questions: cat.questions.map((q, qi) => ({
                id: `jeo-${ci}-${qi}`,
                question: q.q,
                answer: q.a,
                points: (qi + 1) * 100,
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
app.prepare().then(() => {
    const httpServer = (0, http_1.createServer)((req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url, true);
        handle(req, res, parsedUrl);
    });
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);
        // Create Room (Admin)
        socket.on('createRoom', (adminName, callback) => {
            const roomCode = generateRoomCode();
            const adminId = (0, uuid_1.v4)();
            const sessionId = (0, uuid_1.v4)();
            const gameState = createInitialGameState(roomCode, adminId);
            // Admin is NOT a player - they are the game master
            // Store admin name and session for reconnect
            gameState.adminName = adminName;
            gameState.adminSessionId = sessionId;
            const room = {
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
                        io.to(roomCode).emit('gameState', room.gameState);
                        io.to(roomCode).emit('playerReconnected', existingPlayerId);
                        return;
                    }
                }
                callback({ success: false, error: 'Spiel läuft bereits' });
                return;
            }
            const playerId = (0, uuid_1.v4)();
            const player = createPlayer(playerId, playerName, sessionId);
            room.gameState.players.push(player);
            room.sessions.set(sessionId, playerId);
            room.gameState.updatedAt = Date.now();
            playerSockets.set(socket.id, playerId);
            socketRooms.set(socket.id, roomCode);
            socket.join(roomCode);
            callback({ success: true, playerId });
            io.to(roomCode).emit('gameState', room.gameState);
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
            const adminSessionId = room.gameState.adminSessionId;
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
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            // Initialize all game modes
            room.gameState.lastManStanding = generateLMSRounds();
            room.gameState.millionaire = generateMillionaireQuestions();
            room.gameState.higherLower = generateHigherLowerRounds();
            room.gameState.jeopardy = generateJeopardyCategories();
            // Initialize player lives for Higher or Lower
            room.gameState.players.forEach(p => {
                room.gameState.higherLower.playerLives[p.id] = 2;
            });
            room.gameState.currentMode = 'lastManStanding';
            room.gameState.phase = 'playing';
            room.gameState.modeIndex = 0;
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Admin: Show Leaderboard
        socket.on('showLeaderboard', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            // Transfer current mode scores to total
            room.gameState.players.forEach(p => {
                p.totalScore += p.currentModeScore;
                p.currentModeScore = 0;
            });
            room.gameState.currentMode = 'leaderboard';
            room.gameState.phase = 'results';
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Admin: Next Step
        socket.on('nextStep', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const modes = ['lastManStanding', 'millionaire', 'higherLower', 'jeopardy'];
            if (room.gameState.currentMode === 'leaderboard') {
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
                }
                else {
                    room.gameState.currentMode = 'finale';
                    room.gameState.phase = 'playing';
                }
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Admin: Start Finale
        socket.on('startFinale', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            room.gameState.currentMode = 'finale';
            room.gameState.phase = 'playing';
            room.gameState.finaleRevealed = [];
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Admin: Reveal Next Finalist
        socket.on('revealNextFinalist', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const sortedPlayers = [...room.gameState.players].sort((a, b) => a.totalScore - b.totalScore);
            const unrevealed = sortedPlayers.filter(p => !room.gameState.finaleRevealed.includes(p.id));
            if (unrevealed.length > 0) {
                room.gameState.finaleRevealed.push(unrevealed[0].id);
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // LMS: Admin reveals a card by clicking on it
        socket.on('revealCard', (cardId) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.lastManStanding)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const lms = room.gameState.lastManStanding;
            const currentRound = lms.rounds[lms.currentRound];
            const card = currentRound.cards.find(c => c.id === cardId);
            if (card && !card.revealed) {
                card.revealed = true;
                // Check if all cards revealed
                if (currentRound.cards.every(c => c.revealed)) {
                    currentRound.roundComplete = true;
                }
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // LMS: Toggle Eliminate Player - click again to undo
        socket.on('eliminatePlayer', (targetPlayerId) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.lastManStanding)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const lms = room.gameState.lastManStanding;
            const currentRound = lms.rounds[lms.currentRound];
            const player = room.gameState.players.find(p => p.id === targetPlayerId);
            if (!player)
                return;
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
            }
            else {
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
            const activePlayers = room.gameState.players.filter(p => !currentRound.eliminatedPlayers.includes(p.id));
            currentRound.roundComplete = activePlayers.length === 0 || currentRound.cards.every(c => c.revealed);
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // LMS: Next Round - award survivors before moving on
        socket.on('nextLmsRound', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.lastManStanding)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const lms = room.gameState.lastManStanding;
            const currentRound = lms.rounds[lms.currentRound];
            // Award surviving players: 1 more point than the last eliminated
            const survivorPoints = currentRound.eliminatedPlayers.length + 1;
            const survivors = room.gameState.players.filter(p => !currentRound.eliminatedPlayers.includes(p.id));
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
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Millionaire: Submit Answer
        socket.on('submitAnswer', (questionId, answer) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.millionaire)
                return;
            const playerId = playerSockets.get(socket.id);
            if (!playerId)
                return;
            const wwm = room.gameState.millionaire;
            if (!wwm.playerAnswers[playerId]) {
                wwm.playerAnswers[playerId] = { answer: null, confirmed: false };
            }
            wwm.playerAnswers[playerId].answer = answer;
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Millionaire: Confirm Answer
        socket.on('confirmAnswer', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.millionaire)
                return;
            const playerId = playerSockets.get(socket.id);
            if (!playerId)
                return;
            const wwm = room.gameState.millionaire;
            if (wwm.playerAnswers[playerId] && wwm.playerAnswers[playerId].answer !== null) {
                wwm.playerAnswers[playerId].confirmed = true;
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Millionaire: Show Results
        socket.on('showMillionaireResults', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.millionaire)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const wwm = room.gameState.millionaire;
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
                }
                else {
                    playerAnswer.correct = false;
                }
            });
            wwm.showingResults = true;
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Millionaire: Next Question
        socket.on('nextQuestion', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.millionaire)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const wwm = room.gameState.millionaire;
            if (wwm.currentQuestionIndex < wwm.questions.length - 1) {
                wwm.currentQuestionIndex++;
                wwm.playerAnswers = {};
                wwm.showingResults = false;
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Higher Lower: Admin places item on scale
        socket.on('holPlaceItem', (itemId, position) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.higherLower)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const hol = room.gameState.higherLower;
            const currentRound = hol.rounds[hol.currentRound];
            // Find item in available items
            const itemIndex = currentRound.items.findIndex(i => i.id === itemId && !i.revealed);
            if (itemIndex === -1)
                return;
            const item = currentRound.items[itemIndex];
            item.revealed = true;
            item.position = position;
            // Insert at position
            currentRound.placedItems.splice(position, 0, item);
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Higher Lower: Admin removes item from scale
        socket.on('holRemoveItem', (itemId) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.higherLower)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const hol = room.gameState.higherLower;
            const currentRound = hol.rounds[hol.currentRound];
            // Find and remove from placed items
            const placedIndex = currentRound.placedItems.findIndex(i => i.id === itemId);
            if (placedIndex !== -1) {
                const item = currentRound.placedItems[placedIndex];
                item.revealed = false;
                item.position = undefined;
                currentRound.placedItems.splice(placedIndex, 1);
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Higher Lower: Admin takes life from player
        socket.on('holTakeLife', (targetPlayerId) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.higherLower)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const hol = room.gameState.higherLower;
            if (hol.playerLives[targetPlayerId] > 0) {
                hol.playerLives[targetPlayerId]--;
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Higher Lower: Admin adds life to player
        socket.on('holAddLife', (targetPlayerId) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.higherLower)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const hol = room.gameState.higherLower;
            if (hol.playerLives[targetPlayerId] < 2) {
                hol.playerLives[targetPlayerId]++;
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Higher Lower: Admin removes points from player
        socket.on('holRemovePoints', (targetPlayerId, points) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.higherLower)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const player = room.gameState.players.find(p => p.id === targetPlayerId);
            if (player) {
                player.currentModeScore = Math.max(0, player.currentModeScore - points);
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Higher Lower: Admin moves to next player
        socket.on('holNextPlayer', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.higherLower)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const hol = room.gameState.higherLower;
            const currentRound = hol.rounds[hol.currentRound];
            const sorted = sortPlayersAlphabetically(room.gameState.players);
            currentRound.currentPlayerIndex = (currentRound.currentPlayerIndex + 1) % sorted.length;
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Higher Lower: Admin awards points
        socket.on('holAwardPoints', (targetPlayerId, points) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.higherLower)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const player = room.gameState.players.find(p => p.id === targetPlayerId);
            if (player) {
                player.currentModeScore += points;
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Higher Lower: Next round
        socket.on('holNextRound', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.higherLower)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            const hol = room.gameState.higherLower;
            if (hol.currentRound < hol.totalRounds - 1) {
                hol.currentRound++;
                // Reset lives for new round
                room.gameState.players.forEach(p => {
                    hol.playerLives[p.id] = 2;
                });
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Jeopardy: Select Category - selecting player answers first without buzzer
        socket.on('selectCategory', (categoryIndex, questionIndex) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.jeopardy)
                return;
            const jeo = room.gameState.jeopardy;
            const question = jeo.categories[categoryIndex].questions[questionIndex];
            if (!question.revealed) {
                jeo.currentQuestion = { ...question };
                jeo.waitingForAnswer = true;
                jeo.buzzerOpen = false;
                jeo.buzzedPlayer = null;
                jeo.openForAll = false;
                // The selecting player gets first attempt without buzzer
                const sorted = sortPlayersAlphabetically(room.gameState.players);
                const selectingPlayer = sorted[jeo.currentPlayerIndex % sorted.length];
                jeo.buzzedPlayer = selectingPlayer.id;
                // Reset buzz tracking for this question
                room.gameState.players.forEach(p => {
                    p.canBuzz = true;
                    p.hasBuzzed = false;
                });
                // Selecting player has "buzzed" (gets first try)
                if (selectingPlayer) {
                    selectingPlayer.hasBuzzed = true;
                }
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Jeopardy: Open Buzzer
        socket.on('openBuzzer', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.jeopardy)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            room.gameState.jeopardy.buzzerOpen = true;
            room.gameState.jeopardy.buzzedPlayer = null;
            // Reset buzz state for all players
            room.gameState.players.forEach(p => {
                p.hasBuzzed = false;
                p.canBuzz = true;
            });
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Jeopardy: Close Buzzer
        socket.on('closeBuzzer', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.jeopardy)
                return;
            const playerId = playerSockets.get(socket.id);
            if (playerId !== room.gameState.adminId)
                return;
            room.gameState.jeopardy.buzzerOpen = false;
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Jeopardy: Buzz
        socket.on('buzz', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.jeopardy)
                return;
            const playerId = playerSockets.get(socket.id);
            if (!playerId)
                return;
            const jeo = room.gameState.jeopardy;
            const player = room.gameState.players.find(p => p.id === playerId);
            if (!jeo.buzzerOpen || jeo.buzzedPlayer || !player?.canBuzz)
                return;
            jeo.buzzedPlayer = playerId;
            jeo.buzzerOpen = false;
            player.hasBuzzed = true;
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
            io.to(roomCode).emit('buzzerPressed', playerId);
        });
        // Jeopardy: Answer Correct
        socket.on('answerCorrect', (correct) => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.jeopardy)
                return;
            const adminPlayerId = playerSockets.get(socket.id);
            if (adminPlayerId !== room.gameState.adminId)
                return;
            const jeo = room.gameState.jeopardy;
            if (jeo.currentQuestion && jeo.buzzedPlayer) {
                const player = room.gameState.players.find(p => p.id === jeo.buzzedPlayer);
                const sorted = sortPlayersAlphabetically(room.gameState.players);
                const selectingPlayer = sorted[jeo.currentPlayerIndex % sorted.length];
                const isSelectingPlayer = jeo.buzzedPlayer === selectingPlayer?.id && !jeo.openForAll;
                if (correct && player) {
                    // Full points if selecting player answered directly, half points if buzzed in
                    const points = isSelectingPlayer ? jeo.currentQuestion.points : Math.floor(jeo.currentQuestion.points / 2);
                    player.currentModeScore += points;
                    // Mark question as answered in the actual category
                    const catIndex = jeo.categories.findIndex(c => c.questions.some(q => q.id === jeo.currentQuestion.id));
                    if (catIndex !== -1) {
                        const qIndex = jeo.categories[catIndex].questions.findIndex(q => q.id === jeo.currentQuestion.id);
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
                }
                else {
                    // Wrong answer - this player can't buzz again for this question
                    if (player) {
                        player.canBuzz = false;
                    }
                    jeo.buzzedPlayer = null;
                    // Check if everyone has tried
                    const canStillBuzz = room.gameState.players.filter(p => p.canBuzz && !p.hasBuzzed);
                    if (canStillBuzz.length === 0) {
                        // Reset so everyone can buzz again
                        room.gameState.players.forEach(p => {
                            p.hasBuzzed = false;
                            // Keep canBuzz as false for those who answered wrong
                        });
                    }
                    // Open buzzer for others
                    jeo.openForAll = true;
                    jeo.buzzerOpen = true;
                }
            }
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Jeopardy: Discard question (no one knows answer)
        socket.on('jeopardyDiscard', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.jeopardy)
                return;
            const adminPlayerId = playerSockets.get(socket.id);
            if (adminPlayerId !== room.gameState.adminId)
                return;
            const jeo = room.gameState.jeopardy;
            if (jeo.currentQuestion) {
                // Mark question as revealed but unanswered
                const catIndex = jeo.categories.findIndex(c => c.questions.some(q => q.id === jeo.currentQuestion.id));
                if (catIndex !== -1) {
                    const qIndex = jeo.categories[catIndex].questions.findIndex(q => q.id === jeo.currentQuestion.id);
                    if (qIndex !== -1) {
                        jeo.categories[catIndex].questions[qIndex].revealed = true;
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
            io.to(roomCode).emit('gameState', room.gameState);
        });
        // Jeopardy: Reset buzzer for all players
        socket.on('jeopardyResetBuzzer', () => {
            const roomCode = socketRooms.get(socket.id);
            if (!roomCode)
                return;
            const room = rooms.get(roomCode);
            if (!room || !room.gameState.jeopardy)
                return;
            const adminPlayerId = playerSockets.get(socket.id);
            if (adminPlayerId !== room.gameState.adminId)
                return;
            // Reset all players' buzz state
            room.gameState.players.forEach(p => {
                p.canBuzz = true;
                p.hasBuzzed = false;
            });
            room.gameState.jeopardy.buzzerOpen = true;
            room.gameState.jeopardy.buzzedPlayer = null;
            room.gameState.updatedAt = Date.now();
            io.to(roomCode).emit('gameState', room.gameState);
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
                        io.to(roomCode).emit('gameState', room.gameState);
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
function checkHigherLowerPlacement(placedItems, newItem, position) {
    if (placedItems.length === 0)
        return true;
    const before = position > 0 ? placedItems[position - 1] : null;
    const after = position < placedItems.length ? placedItems[position] : null;
    if (before && newItem.value < before.value)
        return false;
    if (after && newItem.value > after.value)
        return false;
    return true;
}
