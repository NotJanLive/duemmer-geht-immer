import { createServer } from 'http';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, Role, ServerToClientEvents } from './src/types/game';
import { applyHostAction, applyPlayerAction } from './server/game';
import { handleAdmin, isAdminRequest } from './server/admin';
import { handleApi, isApiRequest } from './server/api';
import { handleAuth, isAuthRequest, overlayKey, userIdFromCookie } from './server/auth';
import { handleInteraction, isInteractionRequest, setupBot } from './server/bot';
import { getUser } from './server/db';
import { awardWinners, isHostId, loadGuildOwner } from './server/discord';
import { isMediaRequest, serveMedia } from './server/media';
import { getPool } from './server/pool';
import { finaleDurationMs, recordShow } from './server/record';
import {
  Show,
  attachPlayerSocket,
  createShow,
  detachSocket,
  endShow,
  getLive,
  hostView,
  joinShow,
  liveInfo,
  needsPersonalView,
  personalView,
  playerView,
  removePlayer,
} from './server/show';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

interface SocketData {
  userId?: string; // null for the OBS overlay
  overlay?: boolean;
  role?: Role;
  showId?: string;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const HOST = 'show:host';
const PLAYERS = 'show:players';
const VIEWERS = 'show:viewers';

function broadcast(io: GameServer, show: Show) {
  const full = hostView(show);
  io.to(HOST).emit('state', full);

  const base = playerView(full);
  io.to(VIEWERS).emit('state', base);
  if (needsPersonalView(base)) {
    for (const [playerId, sockets] of show.playerSockets) {
      const view = personalView(base, playerId, full);
      for (const id of sockets) io.to(id).emit('state', view);
    }
  } else {
    io.to(PLAYERS).emit('state', base);
  }
  io.emit('live', liveInfo());
}

function leaveChannels(socket: GameSocket) {
  socket.leave(HOST);
  socket.leave(PLAYERS);
  socket.leave(VIEWERS);
  socket.data.role = undefined;
  socket.data.showId = undefined;
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
  await loadGuildOwner();
  void setupBot();

  const httpServer = createServer((req, res) => {
    const url = req.url ?? '';
    const fail = (what: string) => (err: unknown) => {
      console.error(`${what} failed:`, err);
      if (!res.headersSent) res.writeHead(500).end();
    };
    if (isAuthRequest(url)) return void handleAuth(req, res).catch(fail('Auth'));
    if (isInteractionRequest(url)) return void handleInteraction(req, res).catch(fail('Interaction'));
    if (isAdminRequest(url)) return void handleAdmin(req, res).catch(fail('Admin'));
    if (isApiRequest(url)) {
      try {
        return handleApi(req, res);
      } catch (err) {
        return fail('API')(err);
      }
    }
    if (isMediaRequest(url) && (req.method === 'GET' || req.method === 'HEAD')) return serveMedia(req, res);
    handle(req, res);
  });
  const io: GameServer = new Server(httpServer, {
    pingInterval: 10000,
    pingTimeout: 8000,
  });

  // Only members with a session cookie, or the OBS overlay with its key.
  io.use((socket, nextFn) => {
    const key = (socket.handshake.auth as { overlay?: string } | undefined)?.overlay;
    if (key && key === overlayKey()) {
      socket.data.overlay = true;
      return nextFn();
    }
    const id = userIdFromCookie(socket.handshake.headers.cookie);
    if (!id || !getUser(id)) return nextFn(new Error('unauthorized'));
    socket.data.userId = id;
    nextFn();
  });

  function attach(socket: GameSocket, show: Show, role: Role) {
    leaveChannels(socket);
    socket.data.role = role;
    socket.data.showId = show.id;
    if (role === 'host') {
      socket.join(HOST);
      show.hostSockets.add(socket.id);
    } else if (role === 'player') {
      socket.join(PLAYERS);
      attachPlayerSocket(show, socket.data.userId!, socket.id);
    } else {
      socket.join(VIEWERS);
      show.viewerSockets.add(socket.id);
    }
    broadcast(io, show);
  }

  function finishShow(show: Show, message: string) {
    if (show.awardTimer) clearTimeout(show.awardTimer);
    if (show.recorded && !show.recorded.awarded) void awardWinners(show.recorded);
    io.to(PLAYERS).to(VIEWERS).emit('closed', message);
    for (const room of [HOST, PLAYERS, VIEWERS]) io.in(room).socketsLeave(room);
    endShow();
    io.emit('live', liveInfo());
  }

  io.on('connection', (socket: GameSocket) => {
    const userId = socket.data.userId;
    const isHost = !!userId && isHostId(userId);
    const current = () => {
      const show = getLive();
      return show && show.id === socket.data.showId ? show : undefined;
    };

    socket.emit('live', liveInfo());

    socket.on('createShow', safe('createShow', (cb) => {
      if (!isHost) return reply(cb, { ok: false, error: 'Nur der Host kann eine Show starten' });
      const show = getLive() ?? createShow(getUser(userId)!);
      attach(socket, show, 'host');
      reply(cb, { ok: true, role: 'host', playerId: null });
    }));

    // Called by the show page on every (re)connect.
    socket.on('enter', safe('enter', (opts, cb) => {
      const show = getLive();
      if (!show) return reply(cb, { ok: false, error: 'Gerade läuft keine Show' });
      if (socket.data.overlay) {
        attach(socket, show, 'viewer');
        return reply(cb, { ok: true, role: 'viewer', playerId: null });
      }
      if (isHost) {
        attach(socket, show, 'host');
        return reply(cb, { ok: true, role: 'host', playerId: null });
      }
      const seated = show.game.players.some((p) => p.id === userId);
      if (seated || opts?.join) {
        const result = joinShow(show, getUser(userId!)!);
        if ('player' in result) {
          attach(socket, show, 'player');
          return reply(cb, { ok: true, role: 'player', playerId: userId });
        }
        if (!seated && opts?.join && show.game.screen === 'lobby') return reply(cb, { ok: false, error: result.error });
      }
      attach(socket, show, 'viewer');
      reply(cb, { ok: true, role: 'viewer', playerId: null });
    }));

    socket.on('leaveShow', safe('leaveShow', () => {
      const show = current();
      if (!show) return;
      if (socket.data.role === 'player' && show.game.screen === 'lobby') removePlayer(show, userId!);
      detachSocket(show, socket.id);
      leaveChannels(socket);
      broadcast(io, show);
    }));

    // Cam on or off, so the others only open a viewer when there is a stream.
    socket.on('cam', safe('cam', (on) => {
      const show = current();
      if (!show) return;
      const value = on === true;
      if (socket.data.role === 'host') show.host.camOn = value;
      else if (socket.data.role === 'player') {
        const p = show.game.players.find((pl) => pl.id === userId);
        if (p) p.camOn = value;
      } else return;
      broadcast(io, show);
    }));

    socket.on('host', safe('host', (action) => {
      const show = current();
      if (!show || socket.data.role !== 'host' || !action || typeof action !== 'object') return;

      if (action.type === 'closeShow') return finishShow(show, 'Die Show ist vorbei.');
      if (action.type === 'kick') {
        if (show.game.screen !== 'lobby') return;
        for (const id of show.playerSockets.get(action.playerId) ?? []) {
          const target = io.sockets.sockets.get(id);
          target?.emit('closed', 'Du wurdest aus der Show entfernt.');
          if (target) leaveChannels(target);
        }
        removePlayer(show, action.playerId);
        broadcast(io, show);
        return;
      }
      if (!applyHostAction(show.game, action)) return;

      if (show.game.screen === 'finale' && !show.recorded) show.recorded = recordShow(show);
      if (action.type === 'finale.start' && show.recorded && !show.recorded.awarded && !show.awardTimer) {
        const record = show.recorded;
        show.awardTimer = setTimeout(() => void awardWinners(record), finaleDurationMs(show));
      }
      broadcast(io, show);
    }));

    socket.on('player', safe('player', (action) => {
      const show = current();
      if (!show || socket.data.role !== 'player' || !action || typeof action !== 'object') return;
      if (applyPlayerAction(show.game, userId!, action)) broadcast(io, show);
    }));

    socket.on('disconnect', () => {
      const show = current();
      if (!show) return;
      detachSocket(show, socket.id);
      broadcast(io, show);
    });
  });

  // HOST=127.0.0.1 keeps a test server off the network.
  httpServer.listen(port, process.env.HOST || '0.0.0.0', () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? 'dev' : 'production'})`);
  });
}
