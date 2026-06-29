const envApiBaseUrl = import.meta.env.VITE_API_URL;
const fallbackApiBaseUrl = import.meta.env.DEV ? 'http://localhost:3333/api' : '/api';
const resolvedApiBaseUrl = envApiBaseUrl || fallbackApiBaseUrl;

if (!resolvedApiBaseUrl) {
  throw new Error('VITE_API_URL nao definida para build de producao do frontend.');
}

const API_BASE_URL = resolvedApiBaseUrl.replace(/\/$/, '');

function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function getToken() {
  return localStorage.getItem('bilhete.token');
}

export function saveToken(token) {
  localStorage.setItem('bilhete.token', token);
}

export function clearToken() {
  localStorage.removeItem('bilhete.token');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = 'Erro na requisicao';
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (error) {
      // Ignore JSON parse failure and use default message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  loginGoogle: (payload) => request('/auth/google', { method: 'POST', body: JSON.stringify(payload) }),
  loginIcloud: (payload) => request('/auth/apple', { method: 'POST', body: JSON.stringify(payload) }),
  loginFacebook: (payload) => request('/auth/facebook', { method: 'POST', body: JSON.stringify(payload) }),

  me: () => request('/me'),
  updateMe: (payload) => request('/me', { method: 'PUT', body: JSON.stringify(payload) }),

  venues: (coords, radiusKm) => {
    const params = new URLSearchParams();
    if (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)) {
      params.set('lat', String(coords.lat));
      params.set('lng', String(coords.lng));
    }

    if (Number.isFinite(radiusKm) && radiusKm > 0) {
      params.set('radiusKm', String(radiusKm));
    }

    const query = params.toString();
    return request(`/venues${query ? `?${query}` : ''}`);
  },
  venuePeople: (venueId) => request(`/venues/${venueId}/people`),
  venueDetails: (venueId) => request(`/venues/${venueId}/details`),
  venueMenu: (venueId) => request(`/venues/${venueId}/menu`),
  radar: () => request('/radar'),

  currentCheckin: () => request('/checkins/current'),
  checkin: (venueId) => request('/checkins', { method: 'POST', body: JSON.stringify({ venueId }) }),
  checkout: () => request('/checkout', { method: 'POST' }),

  sendBilhete: (payload) => request('/bilhetes', { method: 'POST', body: JSON.stringify(payload) }),
  bilhetesInbox: () => request('/bilhetes/inbox'),
  bilhetesOutbox: () => request('/bilhetes/outbox'),
  respondBilhete: (id, action) => request(`/bilhetes/${id}/respond`, { method: 'POST', body: JSON.stringify({ action }) }),

  chats: () => request('/chats'),
  messages: (chatId) => request(`/chats/${chatId}/messages`),
  sendMessage: (chatId, message) =>
    request(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
  socialStartUrl: (provider) => {
    if (provider === 'google') {
      return buildApiUrl('/auth/google/start');
    }
    if (provider === 'icloud') {
      return buildApiUrl('/auth/apple/start');
    }
    if (provider === 'facebook') {
      return buildApiUrl('/auth/facebook/start');
    }

    throw new Error('Provedor social invalido.');
  },
};
