import { createServer } from 'http';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, Role, ServerToClientEvents } from './src/types/game';
import { applyHostAction, applyPlayerAction } from './server/game';
import { handleAdmin, isAdminRequest } from './server/admin';
import { isMediaRequest, serveMedia } from './server/media';
import { getPool } from './server/pool';
import {
  Room,
  attachPlayerSocket,
  cleanName,
  createRoom,
  detachSocket,
  hostView,
  isRoomIdle,
  joinRoom,
  normalizeCode,
  needsPersonalView,
  personalView,
  playerView,
  removePlayer,
  rooms,
} from './server/rooms';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

interface SocketData {
  roomCode?: string;
  role?: Role;
  playerId?: string;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const hostChannel = (code: string) => `${code}:host`;
const playerChannel = (code: string) => `${code}:players`;

function broadcast(io: GameServer, room: Room) {
  room.lastActivity = Date.now();
  const full = hostView(room);
  io.to(hostChannel(room.code)).emit('state', full);

  const base = playerView(room, full);
  if (needsPersonalView(base)) {
    for (const [playerId, sockets] of room.playerSockets) {
      const view = personalView(base, playerId, full);
      for (const id of sockets) io.to(id).emit('state', view);
    }
  } else {
    io.to(playerChannel(room.code)).emit('state', base);
  }
}

function leaveCurrentRoom(io: GameServer, socket: GameSocket) {
  const { roomCode } = socket.data;
  if (!roomCode) return;
  socket.leave(hostChannel(roomCode));
  socket.leave(playerChannel(roomCode));
  socket.data = {};
  const room = rooms.get(roomCode);
  if (room) {
    detachSocket(room, socket.id);
    broadcast(io, room);
  }
}

function enterAsHost(io: GameServer, socket: GameSocket, room: Room) {
  if (socket.data.roomCode !== room.code) leaveCurrentRoom(io, socket);
  socket.data = { roomCode: room.code, role: 'host' };
  socket.join(hostChannel(room.code));
  room.hostSockets.add(socket.id);
  broadcast(io, room);
}

function enterAsPlayer(io: GameServer, socket: GameSocket, room: Room, playerId: string) {
  if (socket.data.roomCode !== room.code) leaveCurrentRoom(io, socket);
  socket.data = { roomCode: room.code, role: 'player', playerId };
  socket.join(playerChannel(room.code));
  attachPlayerSocket(room, playerId, socket.id);
  broadcast(io, room);
}

// Wraps a handler so bad input can never take the server down.
function safe<A extends unknown[]>(name: string, fn: (...args: A) => void) {
  return (...args: A) => {
    try {
      fn(...args);
    } catch (err) {
      console.error(`Handler ${name} failed:`, err);
    }
  };
}

function reply<T>(cb: unknown, value: T) {
  if (typeof cb === 'function') cb(value);
}

app().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function app() {
  const nextApp = next({ dev, port });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();

  getPool(); // load or seed the pool before the first game

  const httpServer = createServer((req, res) => {
    if (isAdminRequest(req.url ?? '')) {
      handleAdmin(req, res).catch((err) => {
        console.error('Admin request failed:', err);
        if (!res.headersSent) res.writeHead(500).end();
      });
      return;
    }
    if (isMediaRequest(req.url ?? '') && (req.method === 'GET' || req.method === 'HEAD')) {
      serveMedia(req, res);
      return;
    }
    handle(req, res);
  });
  const io: GameServer = new Server(httpServer, {
    pingInterval: 10000,
    pingTimeout: 8000,
  });

  io.on('connection', (socket: GameSocket) => {
    const currentRoom = () => (socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined);

    socket.on('createRoom', safe('createRoom', (hostName, cb) => {
      const name = cleanName(hostName);
      if (!name) return reply(cb, { ok: false, error: 'Bitte gib deinen Namen ein' });
      const room = createRoom(name);
      enterAsHost(io, socket, room);
      reply(cb, { ok: true, roomCode: room.code, sessionId: room.hostSessionId, role: 'host' });
    }));

    socket.on('joinRoom', safe('joinRoom', (code, playerName, sessionId, cb) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) return reply(cb, { ok: false, error: 'Raum nicht gefunden' });
      const name = cleanName(playerName);
      if (!name) return reply(cb, { ok: false, error: 'Bitte gib deinen Namen ein' });
      const result = joinRoom(room, name, typeof sessionId === 'string' ? sessionId : null);
      if ('error' in result) return reply(cb, { ok: false, error: result.error });
      enterAsPlayer(io, socket, room, result.player.id);
      reply(cb, { ok: true, roomCode: room.code, sessionId: result.sessionId, role: 'player', playerId: result.player.id });
    }));

    // Called by the client on every (re)connect.
    socket.on('resume', safe('resume', (code, sessionId, cb) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) return reply(cb, { ok: false, error: 'Der Raum existiert nicht mehr' });
      if (sessionId === room.hostSessionId) {
        enterAsHost(io, socket, room);
        return reply(cb, { ok: true, roomCode: room.code, role: 'host' });
      }
      const playerId = room.sessions.get(sessionId);
      if (!playerId) return reply(cb, { ok: false, error: 'Deine Sitzung ist abgelaufen' });
      enterAsPlayer(io, socket, room, playerId);
      reply(cb, { ok: true, roomCode: room.code, role: 'player', playerId });
    }));

    socket.on('leaveRoom', safe('leaveRoom', () => {
      const room = currentRoom();
      const { playerId } = socket.data;
      if (room && playerId && room.game.screen === 'lobby') removePlayer(room, playerId);
      leaveCurrentRoom(io, socket);
    }));

    socket.on('host', safe('host', (action) => {
      const room = currentRoom();
      if (!room || socket.data.role !== 'host' || !action || typeof action !== 'object') return;

      if (action.type === 'closeRoom') {
        io.to(playerChannel(room.code)).emit('closed', 'Der Spielleiter hat das Spiel beendet.');
        io.in(hostChannel(room.code)).socketsLeave(hostChannel(room.code));
        io.in(playerChannel(room.code)).socketsLeave(playerChannel(room.code));
        rooms.delete(room.code);
        return;
      }
      if (action.type === 'kick') {
        if (room.game.screen !== 'lobby') return;
        for (const id of room.playerSockets.get(action.playerId) ?? []) {
          const target = io.sockets.sockets.get(id);
          target?.emit('closed', 'Du wurdest aus dem Raum entfernt.');
          target?.leave(playerChannel(room.code));
          if (target) target.data = {};
        }
        removePlayer(room, action.playerId);
        broadcast(io, room);
        return;
      }
      if (applyHostAction(room.game, action)) broadcast(io, room);
    }));

    socket.on('player', safe('player', (action) => {
      const room = currentRoom();
      const { playerId } = socket.data;
      if (!room || !playerId || !action || typeof action !== 'object') return;
      if (applyPlayerAction(room.game, playerId, action)) broadcast(io, room);
    }));

    socket.on('disconnect', () => {
      const room = currentRoom();
      if (!room) return;
      detachSocket(room, socket.id);
      broadcast(io, room);
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) if (isRoomIdle(room, now)) rooms.delete(code);
  }, 10 * 60 * 1000).unref();

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? 'dev' : 'production'})`);
  });
}
