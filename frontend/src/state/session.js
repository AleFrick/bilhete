import { clearToken, saveToken } from '../api/client';

const USER_KEY = 'bilhete.user';

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

export function persistSession(token, user) {
  saveToken(token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  clearToken();
  localStorage.removeItem(USER_KEY);
}
