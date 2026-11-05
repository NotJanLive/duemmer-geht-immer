import { Role } from '@/types/game';

export interface StoredSession {
  roomCode: string;
  sessionId: string;
  role: Role;
  name: string;
}

const KEY = 'dgi_session';

// Storage can throw in private mode, so every access is guarded.
export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

// Keeps the player's seat if they join again from the same browser.
export function sessionIdFor(roomCode: string): string | null {
  const s = loadSession();
  return s && s.roomCode === roomCode ? s.sessionId : null;
}

export function lastName(): string {
  return loadSession()?.name ?? '';
}
