import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, HostAction, PlayerAction, ServerToClientEvents } from '@/types/game';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

// The session cookie goes along with the handshake. The OBS overlay has no
// login and sends its key instead.
export function getSocket(overlayKey?: string): GameSocket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      // A hanging attempt would otherwise block the next retry for 20 s.
      timeout: 5000,
      transports: ['websocket', 'polling'],
      auth: overlayKey ? { overlay: overlayKey } : {},
    });
  }
  return socket;
}

export const hostAction = (action: HostAction) => getSocket().emit('host', action);
export const playerAction = (action: PlayerAction) => getSocket().emit('player', action);
