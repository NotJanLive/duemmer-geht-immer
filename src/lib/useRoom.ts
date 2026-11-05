'use client';

import { useEffect } from 'react';
import { getSocket } from './socket';
import { clearSession, loadSession } from './session';
import { useRoomStore } from './store';

// Keeps this tab attached to its room. Every (re)connect re-sends `resume`, so a
// locked phone or a wifi drop picks up where it left off without a reload.
export function useRoom(roomCode: string) {
  useEffect(() => {
    const session = loadSession();
    const set = useRoomStore.setState;

    if (!session || session.roomCode !== roomCode) {
      set({ closedMessage: 'Du bist in diesem Raum nicht angemeldet.' });
      return;
    }

    set({ role: session.role, status: 'connecting', closedMessage: null });
    const socket = getSocket();

    const onConnect = () => {
      socket.emit('resume', roomCode, session.sessionId, (r) => {
        if (!r.ok) {
          clearSession();
          set({ closedMessage: r.error ?? 'Verbindung fehlgeschlagen' });
          return;
        }
        set({ status: 'online', role: r.role ?? session.role, playerId: r.playerId ?? null });
      });
    };
    const onDisconnect = () => set({ status: 'offline' });
    const onState: Parameters<typeof socket.on<'state'>>[1] = (state) =>
      set({ state, clockOffset: state.serverTime - Date.now() });
    const onClosed = (message: string) => {
      clearSession();
      set({ closedMessage: message });
      socket.disconnect();
    };
    // Back in the foreground or online again: retry right away instead of
    // waiting for the backoff timer.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !socket.connected) socket.disconnect().connect();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    socket.on('closed', onClosed);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
      socket.off('closed', onClosed);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [roomCode]);
}
