import { v4 as uuidv4 } from 'uuid';

const SESSION_KEY = 'dgi_session_id';
const ROOM_KEY = 'dgi_room_code';
const PLAYER_NAME_KEY = 'dgi_player_name';
const PLAYER_ID_KEY = 'dgi_player_id';
const IS_ADMIN_KEY = 'dgi_is_admin';

export const getSessionId = (): string => {
  if (typeof window === 'undefined') return '';
  
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

export const setSessionId = (id: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, id);
};

export const getStoredRoomCode = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ROOM_KEY);
};

export const setStoredRoomCode = (code: string | null) => {
  if (typeof window === 'undefined') return;
  if (code) {
    localStorage.setItem(ROOM_KEY, code);
  } else {
    localStorage.removeItem(ROOM_KEY);
  }
};

export const getStoredPlayerName = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PLAYER_NAME_KEY);
};

export const setStoredPlayerName = (name: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PLAYER_NAME_KEY, name);
};

export const getStoredPlayerId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PLAYER_ID_KEY);
};

export const setStoredPlayerId = (id: string | null) => {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(PLAYER_ID_KEY, id);
  } else {
    localStorage.removeItem(PLAYER_ID_KEY);
  }
};

export const getStoredIsAdmin = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(IS_ADMIN_KEY) === 'true';
};

export const setStoredIsAdmin = (isAdmin: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(IS_ADMIN_KEY, isAdmin ? 'true' : 'false');
};

export const clearSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ROOM_KEY);
  localStorage.removeItem(PLAYER_NAME_KEY);
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(IS_ADMIN_KEY);
  // Keep session ID for potential reconnects
};
