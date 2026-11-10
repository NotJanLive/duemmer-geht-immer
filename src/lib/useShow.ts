'use client';

import { useEffect } from 'react';
import { getSocket } from './socket';
import { useRoomStore } from './store';

// Keeps this tab attached to the live show. Every (re)connect re-sends
// `enter`, so a locked phone or a wifi drop picks up where it left off.
export function useShow({ join = false, overlayKey }: { join?: boolean; overlayKey?: string } = {}) {
  useEffect(() => {
    const set = useRoomStore.setState;
    set({ status: 'connecting', closedMessage: null });
    const socket = getSocket(overlayKey);
    let wantJoin = join;

    const onConnect = () => {
      socket.emit('enter', { join: wantJoin }, (r) => {
        if (!r.ok) {
          // The overlay waits for the next show instead of giving up.
          if (overlayKey) set({ state: null, status: 'online' });
          else set({ closedMessage: r.error ?? 'Verbindung fehlgeschlagen' });
          return;
        }
        wantJoin = false; // joined once; later reconnects keep the seat anyway
        set({ status: 'online', role: r.role ?? null, playerId: r.playerId ?? null, closedMessage: null });
      });
    };
    const onDisconnect = () => set({ status: 'offline' });
    const onState: Parameters<typeof socket.on<'state'>>[1] = (state) => set({ state, clockOffset: state.serverTime - Date.now() });
    const onLive: Parameters<typeof socket.on<'live'>>[1] = (live) => {
      const before = useRoomStore.getState();
      set({ live });
      // The overlay picks up a new show by itself.
      if (overlayKey && live.active && !before.state) onConnect();
    };
    const onClosed = (message: string) => {
      if (overlayKey) set({ state: null, role: null });
      else set({ closedMessage: message, state: null });
    };
    const onError = (err: Error) => {
      if (err.message === 'unauthorized') set({ closedMessage: 'Bitte melde dich zuerst mit Discord an.' });
    };
    // Back in the foreground or online again: retry right away.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !socket.connected) socket.disconnect().connect();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    socket.on('live', onLive);
    socket.on('closed', onClosed);
    socket.on('connect_error', onError);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
      socket.off('live', onLive);
      socket.off('closed', onClosed);
      socket.off('connect_error', onError);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [join, overlayKey]);
}
