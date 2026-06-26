import { clearAdminToken, saveAdminToken } from '../api/adminClient';

const ADMIN_USER_KEY = 'bilhete.admin.user';
const USER_KEY = 'bilhete.user';

export function loadAdminUser() {
  const raw = localStorage.getItem(ADMIN_USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(ADMIN_USER_KEY);
    return null;
  }
}

export function persistAdminSession(token, user) {
  saveAdminToken(token);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAdminSession() {
  clearAdminToken();
  localStorage.removeItem(ADMIN_USER_KEY);
  localStorage.removeItem(USER_KEY);
}
