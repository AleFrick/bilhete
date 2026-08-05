const envApiBaseUrl = import.meta.env.VITE_API_URL;
const fallbackApiBaseUrl = import.meta.env.DEV ? 'http://localhost:3333/api' : '/api';
const resolvedApiBaseUrl = envApiBaseUrl || fallbackApiBaseUrl;

if (!resolvedApiBaseUrl) {
  throw new Error('VITE_API_URL nao definida para build de producao do frontend.');
}

const API_BASE_URL = resolvedApiBaseUrl.replace(/\/$/, '');

export { API_BASE_URL };

function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function getToken() {
  return localStorage.getItem('bilhete.token');
}

export function saveToken(token) {
  localStorage.setItem('bilhete.token', token);
}

export function clearToken() {
  localStorage.removeItem('bilhete.token');
}

export function getRefreshToken() {
  return localStorage.getItem('bilhete.refreshToken');
}

export function saveRefreshToken(token) {
  localStorage.setItem('bilhete.refreshToken', token);
}

export function clearRefreshToken() {
  localStorage.removeItem('bilhete.refreshToken');
}

let refreshingPromise = null;

async function tryRefreshToken() {
  if (refreshingPromise) {
    return refreshingPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  refreshingPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearToken();
        clearRefreshToken();
        return false;
      }

      const data = await response.json();
      saveToken(data.token);
      if (data.refreshToken) {
        saveRefreshToken(data.refreshToken);
      }
      return true;
    } catch {
      clearToken();
      clearRefreshToken();
      return false;
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
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

  if (response.status === 401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getToken();
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };

      const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: retryHeaders,
      });

      if (!retryResponse.ok) {
        let message = 'Erro na requisicao';
        try {
          const data = await retryResponse.json();
          message = data.message || message;
        } catch (error) {
          // Ignore JSON parse failure and use default message.
        }
        throw new Error(message);
      }

      if (retryResponse.status === 204) {
        return null;
      }

      return retryResponse.json();
    }

    clearToken();
    clearRefreshToken();
    let message = 'Sessao expirada. Faca login novamente.';
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (error) {
      // Ignore
    }
    throw new Error(message);
  }

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
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  logout: (refreshToken) => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: refreshToken || undefined }) }),

  getActiveTerms: () => request('/terms/active'),
  getTermsStatus: () => request('/terms/status'),
  acceptTerms: () => request('/terms/accept', { method: 'POST' }),
  getTermsHistory: () => request('/terms/history'),

  getNotifications: () => request('/notifications'),
  markNotificationsRead: () => request('/notifications/read', { method: 'POST' }),

  me: () => request('/me'),
  updateMe: (payload) => request('/me', { method: 'PUT', body: JSON.stringify(payload) }),
  changeEmail: (newEmail) => request('/me/email', { method: 'PUT', body: JSON.stringify({ newEmail }) }),
  deleteAccount: (password) => request('/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
  publicVenue: (venueId) => request(`/public/venues/${venueId}`),

  venues: (coords, radiusKm, city) => {
    const params = new URLSearchParams();
    if (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)) {
      params.set('lat', String(coords.lat));
      params.set('lng', String(coords.lng));
    }

    if (Number.isFinite(radiusKm) && radiusKm > 0) {
      params.set('radiusKm', String(radiusKm));
    }

    if (city) {
      params.set('city', city);
    }

    const query = params.toString();
    return request(`/venues${query ? `?${query}` : ''}`);
  },
  venueCities: () => request('/venues/cities'),
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
  premiumCatalog: () => request('/premium/catalog'),
  premiumCheckout: (payload) => request('/premium/checkout', { method: 'POST', body: JSON.stringify(payload) }),
  premiumConfirmOrder: (orderId) => request(`/premium/orders/${orderId}/confirm`, { method: 'POST' }),
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
