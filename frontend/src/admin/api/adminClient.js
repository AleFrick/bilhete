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
  venueLinkRequests: ({ status } = {}) => {
    const params = new URLSearchParams();
    if (status) {
      params.set('status', status);
    }

    const query = params.toString();
    return request(`/admin/venue-link-requests${query ? `?${query}` : ''}`);
  },
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
  updateVenueLinkApproval: (venueId, status) =>
    request(`/admin/venues/${venueId}/link-approval`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  geocodeAddress: (query) =>
    request(`/admin/geocode?q=${encodeURIComponent(query)}&nocache=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    }),
  establishmentProfile: () => request('/establishment/profile'),
  updateEstablishmentProfile: (payload) =>
    request('/establishment/profile', { method: 'PUT', body: JSON.stringify(payload) }),
  establishmentVenueRequests: () => request('/establishment/venues/requests'),
  searchVenuesForLink: ({ city, q } = {}) => {
    const params = new URLSearchParams();
    if (city) {
      params.set('city', city);
    }
    if (q) {
      params.set('q', q);
    }

    const query = params.toString();
    return request(`/establishment/venues/search${query ? `?${query}` : ''}`);
  },
  requestNewVenue: (payload) =>
    request('/establishment/venues/request-new', { method: 'POST', body: JSON.stringify(payload) }),
  requestVenueLink: (venueId, payload = {}) =>
    request('/establishment/venues/request-link', {
      method: 'POST',
      body: JSON.stringify({ venueId, ...payload }),
    }),
  establishmentAgenda: ({ year, month } = {}) => {
    const params = new URLSearchParams();
    if (year) {
      params.set('year', String(year));
    }
    if (month) {
      params.set('month', String(month));
    }

    const query = params.toString();
    return request(`/establishment/agenda${query ? `?${query}` : ''}`);
  },
  createEstablishmentAgendaEvent: (payload) =>
    request('/establishment/agenda', { method: 'POST', body: JSON.stringify(payload) }),
  updateEstablishmentAgendaEvent: (eventId, payload) =>
    request(`/establishment/agenda/${eventId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteEstablishmentAgendaEvent: (eventId) =>
    request(`/establishment/agenda/${eventId}`, { method: 'DELETE' }),
  establishmentAgendaStats: ({ startDate, endDate }) => {
    const params = new URLSearchParams();
    params.set('startDate', startDate);
    params.set('endDate', endDate);

    return request(`/establishment/agenda/stats?${params.toString()}`);
  },
  establishmentGeocode: (query) =>
    request(`/establishment/geocode?q=${encodeURIComponent(query)}&nocache=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    }),
};
