import { clearToken, saveToken } from '../api/client';

const USER_KEY = 'bilhete.user';

export function loadUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function persistSession(token, user) {
  saveToken(token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  clearToken();
  localStorage.removeItem(USER_KEY);
}
