import { clearToken, saveToken, getToken } from '../api/client';

const USER_KEY = 'bilhete.user';
const REFRESH_TOKEN_KEY = 'bilhete.refreshToken';

export function loadUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const user = JSON.parse(raw);
    // Never trust stale premium status from cache — always wait for fresh API response
    if (user) {
      user.premiumStatus = false;
    }
    return user;
  } catch (error) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function persistSession(token, user, refreshToken) {
  saveToken(token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearSession() {
  clearToken();
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
