const envApiBaseUrl = import.meta.env.VITE_API_URL;
const fallbackApiBaseUrl = import.meta.env.DEV ? 'http://localhost:3333/api' : '';
const resolvedApiBaseUrl = envApiBaseUrl || fallbackApiBaseUrl;

if (!resolvedApiBaseUrl) {
  throw new Error('VITE_API_URL nao definida para build de producao do frontend.');
}

const API_BASE_URL = resolvedApiBaseUrl.replace(/\/$/, '');
const ADMIN_TOKEN_KEY = 'bilhete.admin.token';

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function saveAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getAdminToken();
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

export const adminApi = {
  login: (payload) => request('/admin/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  venueCities: () => request('/admin/venues/cities'),
  venues: ({ city, q, category } = {}) => {
    const params = new URLSearchParams();
    if (city) {
      params.set('city', city);
    }
    if (q) {
      params.set('q', q);
    }
    if (category) {
      params.set('category', category);
    }

    const query = params.toString();
    return request(`/admin/venues${query ? `?${query}` : ''}`);
  },
  createVenue: (payload) => request('/admin/venues', { method: 'POST', body: JSON.stringify(payload) }),
  updateVenue: (venueId, payload) =>
    request(`/admin/venues/${venueId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  geocodeAddress: (query) =>
    request(`/admin/geocode?q=${encodeURIComponent(query)}&nocache=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    }),
};
