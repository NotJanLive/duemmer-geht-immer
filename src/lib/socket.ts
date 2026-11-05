import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, HostAction, PlayerAction, ServerToClientEvents } from '@/types/game';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      // A hanging attempt would otherwise block the next retry for 20 s.
      timeout: 5000,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket(timeout = 8000): Promise<GameSocket> {
  const s = getSocket();
  if (s.connected) return Promise.resolve(s);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, timeout);
    const onConnect = () => {
      cleanup();
      resolve(s);
    };
    const cleanup = () => {
      clearTimeout(timer);
      s.off('connect', onConnect);
    };
    s.on('connect', onConnect);
    s.connect();
  });
}

export const hostAction = (action: HostAction) => getSocket().emit('host', action);
export const playerAction = (action: PlayerAction) => getSocket().emit('player', action);
