import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@/types/game';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const getSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (!socket) {
    socket = io({
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket'], // Force websocket for minimum latency
    });
  }
  return socket;
};

export const connectSocket = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    
    if (s.connected) {
      resolve();
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 10000);
    
    s.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    
    s.once('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    
    s.connect();
  });
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
