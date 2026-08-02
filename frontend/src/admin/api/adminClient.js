const envApiBaseUrl = import.meta.env.VITE_API_URL;
const fallbackApiBaseUrl = import.meta.env.DEV ? 'http://localhost:3333/api' : '/api';
const resolvedApiBaseUrl = envApiBaseUrl || fallbackApiBaseUrl;

if (!resolvedApiBaseUrl) {
  throw new Error('VITE_API_URL nao definida para build de producao do frontend.');
}

const API_BASE_URL = resolvedApiBaseUrl.replace(/\/$/, '');
const ADMIN_TOKEN_KEY = 'bilhete.admin.token';
const USER_TOKEN_KEY = 'bilhete.token';

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(USER_TOKEN_KEY);
}

export function saveAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(USER_TOKEN_KEY);
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
  logout: () => request('/auth/logout', { method: 'POST' }),
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
  batchCreateVenues: (venues) =>
    request('/admin/venues/batch', { method: 'POST', body: JSON.stringify({ venues }) }),
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
  establishmentDashboard: ({ startDate, endDate }) => {
    const params = new URLSearchParams();
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    return request(`/establishment/dashboard?${params.toString()}`);
  },
  establishmentGeocode: (query) =>
    request(`/establishment/geocode?q=${encodeURIComponent(query)}&nocache=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    }),
  establishmentSupportTickets: ({ status } = {}) => {
    const params = new URLSearchParams();
    if (status) {
      params.set('status', status);
    }

    const query = params.toString();
    return request(`/establishment/support-tickets${query ? `?${query}` : ''}`);
  },
  createEstablishmentSupportTicket: (payload) =>
    request('/establishment/support-tickets', { method: 'POST', body: JSON.stringify(payload) }),
  establishmentSupportTicketMessages: (ticketId) =>
    request(`/establishment/support-tickets/${ticketId}/messages`),
  createEstablishmentSupportTicketMessage: (ticketId, payload) =>
    request(`/establishment/support-tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminSupportTickets: ({ status } = {}) => {
    const params = new URLSearchParams();
    if (status) {
      params.set('status', status);
    }

    const query = params.toString();
    return request(`/admin/support-tickets${query ? `?${query}` : ''}`);
  },
  updateAdminSupportTicket: (ticketId, payload) =>
    request(`/admin/support-tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  adminSupportTicketMessages: (ticketId) =>
    request(`/admin/support-tickets/${ticketId}/messages`),
  createAdminSupportTicketMessage: (ticketId, payload) =>
    request(`/admin/support-tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  establishmentMenuItems: () => request('/establishment/menu'),
  createMenuItem: (payload) =>
    request('/establishment/menu', { method: 'POST', body: JSON.stringify(payload) }),
  updateMenuItem: (itemId, payload) =>
    request(`/establishment/menu/${itemId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteMenuItem: (itemId) =>
    request(`/establishment/menu/${itemId}`, { method: 'DELETE' }),
  premiumCatalog: () => request('/premium/catalog'),
  premiumCheckout: (payload) => request('/premium/checkout', { method: 'POST', body: JSON.stringify(payload) }),
  premiumConfirmOrder: (orderId) => request(`/premium/orders/${orderId}/confirm`, { method: 'POST' }),
  adminPremiumPackages: ({ targetGroup } = {}) => {
    const params = new URLSearchParams();
    if (targetGroup) {
      params.set('targetGroup', targetGroup);
    }
    const query = params.toString();
    return request(`/admin/premium/packages${query ? `?${query}` : ''}`);
  },
  createAdminPremiumPackage: (payload) =>
    request('/admin/premium/packages', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminPremiumPackage: (packageId, payload) =>
    request(`/admin/premium/packages/${packageId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminPremiumCoupons: ({ targetGroup } = {}) => {
    const params = new URLSearchParams();
    if (targetGroup) {
      params.set('targetGroup', targetGroup);
    }
    const query = params.toString();
    return request(`/admin/premium/coupons${query ? `?${query}` : ''}`);
  },
  createAdminPremiumCoupon: (payload) =>
    request('/admin/premium/coupons', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminPremiumCoupon: (couponId, payload) =>
    request(`/admin/premium/coupons/${couponId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminPremiumPromotions: ({ targetGroup } = {}) => {
    const params = new URLSearchParams();
    if (targetGroup) {
      params.set('targetGroup', targetGroup);
    }
    const query = params.toString();
    return request(`/admin/premium/promotions${query ? `?${query}` : ''}`);
  },
  createAdminPremiumPromotion: (payload) =>
    request('/admin/premium/promotions', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminPremiumPromotion: (promotionId, payload) =>
    request(`/admin/premium/promotions/${promotionId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  importPbf: (file, city, bbox) => {
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    params.set('city', city);
    if (bbox) {
      params.set('bbox', bbox);
    }

    const token = getAdminToken();
    return fetch(`${API_BASE_URL}/admin/import/pbf?${params.toString()}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        let message = 'Erro na requisicao';
        try {
          const data = await response.json();
          message = data.message || message;
        } catch {}
        throw new Error(message);
      }
      return response.json();
    });
  },
  getPaymentSettings: () => request('/admin/payment/settings'),
  updatePaymentSettings: (payload) =>
    request('/admin/payment/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  submitRegistration: (payload) =>
    request('/registration/submit', { method: 'POST', body: JSON.stringify(payload) }),
  getRegistrationStatus: () => request('/registration/status'),
  getRegistrationMessages: (requestId) => request(`/registration/${requestId}/messages`),
  sendRegistrationMessage: (requestId, message) =>
    request(`/registration/${requestId}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
  adminRegistrationRequests: ({ status } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const query = params.toString();
    return request(`/admin/registration-requests${query ? `?${query}` : ''}`);
  },
  adminReviewRegistration: (requestId, payload) =>
    request(`/admin/registration-requests/${requestId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  adminListTerms: () => request('/admin/terms'),
  adminCreateTerms: (payload) =>
    request('/admin/terms', { method: 'POST', body: JSON.stringify(payload) }),
  getActiveTerms: () => request('/terms/active'),
  getTermsStatus: () => request('/terms/status'),
  acceptTerms: () => request('/terms/accept', { method: 'POST' }),
};
