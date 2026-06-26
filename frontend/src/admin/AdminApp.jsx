import { useEffect, useState } from 'react';

import { adminApi } from './api/adminClient';
import AdminShell from './layout/AdminShell';
import EstablishmentPanelPage from './pages/EstablishmentPanelPage';
import EstablishmentAgendaPage from './pages/EstablishmentAgendaPage';
import EstablishmentAgendaStatsPage from './pages/EstablishmentAgendaStatsPage';
import AdminLinkRequestsPage from './pages/AdminLinkRequestsPage';
import AdminSupportTicketsPage from './pages/AdminSupportTicketsPage';
import AdminVenuesPage from './pages/AdminVenuesPage';
import EstablishmentSupportTicketsPage from './pages/EstablishmentSupportTicketsPage';
import { clearAdminSession, loadAdminUser, persistAdminSession } from './state/adminSession';

export default function AdminApp() {
  const [adminUser, setAdminUser] = useState(loadAdminUser());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('venues');
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [venues, setVenues] = useState([]);
  const [venuesError, setVenuesError] = useState('');
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [lastSearchFilters, setLastSearchFilters] = useState(null);
  const [linkRequests, setLinkRequests] = useState([]);
  const [loadingLinkRequests, setLoadingLinkRequests] = useState(false);
  const [linkRequestsStatus, setLinkRequestsStatus] = useState('pending');
  const [linkRequestsError, setLinkRequestsError] = useState('');
  const [establishmentHasApprovedLink, setEstablishmentHasApprovedLink] = useState(false);

  const isAuthenticated = Boolean(adminUser?.id);
  const isAdminUser = adminUser?.role === 'admin';
  const isEstablishmentUser = adminUser?.role === 'establishment';

  useEffect(() => {
    if (isAuthenticated && !isAdminUser && !isEstablishmentUser) {
      window.history.replaceState({}, '', '/app');
      window.location.reload();
      return;
    }

    if (!isAuthenticated) {
      window.history.replaceState({}, '', '/');
      window.location.reload();
    }
  }, [isAuthenticated, isAdminUser, isEstablishmentUser]);

  useEffect(() => {
    if (isAdminUser) {
      setActiveTab((prev) => (prev === 'venues' || prev === 'link-requests' || prev === 'support-tickets' ? prev : 'venues'));
      return;
    }

    if (isEstablishmentUser) {
      setActiveTab((prev) => {
        if (prev === 'establishment-profile') {
          return prev;
        }
        if (prev === 'establishment-support') {
          return prev;
        }
        if (prev === 'establishment-agenda' && establishmentHasApprovedLink) {
          return prev;
        }
        if (prev === 'establishment-stats' && establishmentHasApprovedLink) {
          return prev;
        }
        return 'establishment-profile';
      });
    }
  }, [isAdminUser, isEstablishmentUser, establishmentHasApprovedLink]);

  useEffect(() => {
    if (!isAuthenticated || !isEstablishmentUser) {
      setEstablishmentHasApprovedLink(false);
      return;
    }

    let cancelled = false;

    const loadEstablishmentMenuPermissions = async () => {
      try {
        const requests = await adminApi.establishmentVenueRequests();
        const hasApproved = Array.isArray(requests)
          ? requests.some((item) => item.establishmentLinkStatus === 'approved')
          : false;

        if (!cancelled) {
          setEstablishmentHasApprovedLink(hasApproved);
        }
      } catch {
        if (!cancelled) {
          setEstablishmentHasApprovedLink(false);
        }
      }
    };

    loadEstablishmentMenuPermissions();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isEstablishmentUser]);

  const loadCities = async () => {
    setLoadingCities(true);
    setVenuesError('');

    try {
      const data = await adminApi.venueCities();
      setCities(data);
    } catch (error) {
      setVenuesError(error.message);
      if (error.message.toLowerCase().includes('restrito') || error.message.toLowerCase().includes('token')) {
        clearAdminSession();
        setAdminUser(null);
      }
    } finally {
      setLoadingCities(false);
    }
  };

  const loadVenues = async (filters) => {
    setLoadingVenues(true);
    setVenuesError('');
    setVenues([]);

    try {
      const data = await adminApi.venues(filters);
      setVenues(data);
      setLastSearchFilters(filters);
    } catch (error) {
      setVenuesError(error.message);
      if (error.message.toLowerCase().includes('restrito') || error.message.toLowerCase().includes('token')) {
        clearAdminSession();
        setAdminUser(null);
      }
    } finally {
      setLoadingVenues(false);
    }
  };

  const loadLinkRequests = async (status = linkRequestsStatus) => {
    setLoadingLinkRequests(true);
    setLinkRequestsError('');

    try {
      const data = await adminApi.venueLinkRequests({ status });
      setLinkRequests(data || []);
    } catch (error) {
      setLinkRequestsError(error.message);
      if (error.message.toLowerCase().includes('restrito') || error.message.toLowerCase().includes('token')) {
        clearAdminSession();
        setAdminUser(null);
      }
    } finally {
      setLoadingLinkRequests(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdminUser) {
      loadCities();
      loadLinkRequests(linkRequestsStatus);
    }
  }, [isAuthenticated, isAdminUser]);

  useEffect(() => {
    if (!isAuthenticated || !isAdminUser) {
      return;
    }

    loadLinkRequests(linkRequestsStatus);
  }, [linkRequestsStatus]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const pathname = window.location.pathname;
    if (isEstablishmentUser && pathname === '/admin') {
      window.history.replaceState({}, '', '/admin/establishment');
    }

    if (isAdminUser && pathname === '/admin/establishment') {
      window.history.replaceState({}, '', '/admin');
    }
  }, [isAuthenticated, isAdminUser, isEstablishmentUser]);

  const handleLogin = async (payload) => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const data = await adminApi.login(payload);
      persistAdminSession(data.token, data.user);
      setAdminUser(data.user);
      if (data.user?.role === 'establishment') {
        window.history.replaceState({}, '', '/admin/establishment');
      } else {
        window.history.replaceState({}, '', '/admin');
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    setAdminUser(null);
    setCities([]);
    setVenues([]);
    setVenuesError('');
    setLastSearchFilters(null);
    setLinkRequests([]);
    setLinkRequestsError('');
  };

  const handleCreateVenue = async (payload) => {
    setLoadingCreate(true);
    setVenuesError('');

    try {
      const created = await adminApi.createVenue(payload);
      if (lastSearchFilters) {
        await loadVenues(lastSearchFilters);
      }
      return created;
    } catch (error) {
      setVenuesError(error.message);
      throw error;
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleUpdateVenue = async (venueId, payload) => {
    setLoadingCreate(true);
    setVenuesError('');

    try {
      const updated = await adminApi.updateVenue(venueId, payload);
      if (lastSearchFilters) {
        await loadVenues(lastSearchFilters);
      } else {
        setVenues((prev) => prev.map((item) => (item.id === venueId ? updated : item)));
      }
      return updated;
    } catch (error) {
      setVenuesError(error.message);
      throw error;
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleUpdateVenueLinkApproval = async (venueId, status) => {
    setLoadingCreate(true);
    setVenuesError('');

    try {
      const updated = await adminApi.updateVenueLinkApproval(venueId, status);
      setVenues((prev) => prev.map((item) => (item.id === venueId ? updated : item)));
      setLinkRequests((prev) => prev.map((item) => (item.id === venueId ? updated : item)));
      return updated;
    } catch (error) {
      setVenuesError(error.message);
      throw error;
    } finally {
      setLoadingCreate(false);
    }
  };

  if (!isAuthenticated || (!isAdminUser && !isEstablishmentUser)) {
    return null;
  }

  return (
    <AdminShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
      adminName={adminUser?.name}
      title={isEstablishmentUser ? '' : 'Painel Admin'}
      navItems={
        isAdminUser
          ? [
              {
                key: 'venues',
                label: 'Cadastro de locais',
                icon: (
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M12 2 3 7v13h18V7l-9-5Zm0 2.2L18.6 8H5.4L12 4.2ZM5 10h5v8H5v-8Zm7 0h7v8h-7v-8Z" />
                  </svg>
                ),
              },
              {
                key: 'link-requests',
                label: 'Pedidos de vinculacao',
                icon: (
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M10.59 13.41 9.17 12l-2.58 2.59a4 4 0 1 0 5.66 5.65l2.59-2.58-1.42-1.41-2.58 2.58a2 2 0 0 1-2.83-2.83l2.58-2.59Zm2.82-2.82 1.41 1.41 2.58-2.58a2 2 0 1 1 2.83 2.83l-2.58 2.59 1.42 1.41 2.58-2.59a4 4 0 0 0-5.66-5.65l-2.58 2.58ZM8 13h8v-2H8v2Z" />
                  </svg>
                ),
              },
              {
                key: 'support-tickets',
                label: 'Chamados',
                icon: (
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2Zm2 4v2h12V7H6Zm0 4v2h8v-2H6Z" />
                  </svg>
                ),
              },
            ]
          : [
              {
                key: 'establishment-profile',
                label: 'Cadastro',
                icon: (
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
                  </svg>
                ),
              },
              ...(establishmentHasApprovedLink
                ? [
                    {
                      key: 'establishment-agenda',
                      label: 'Agenda',
                      icon: (
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V10h14v9Zm0-11H5V6h14v2Z" />
                        </svg>
                      ),
                    },
                  ]
                : []),
              ...(establishmentHasApprovedLink
                ? [
                    {
                      key: 'establishment-stats',
                      label: 'Estatísticas',
                      icon: (
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M5 9h3v10H5V9Zm5-4h3v14h-3V5Zm5 7h3v7h-3v-7Z" />
                        </svg>
                      ),
                    },
                  ]
                : []),
              {
                key: 'establishment-support',
                label: 'Chamados',
                icon: (
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h4v2h8v-2h4c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 12H4V7h16v10Zm-9-1h2v-2h2v-2h-2v-2h-2v2H9v2h2v2Z" />
                  </svg>
                ),
              },
            ]
      }
    >
      {isAdminUser && activeTab === 'venues' ? (
        <AdminVenuesPage
          cities={cities}
          loadingCities={loadingCities}
          venues={venues}
          loadingVenues={loadingVenues}
          onSearchVenues={loadVenues}
          onCreateVenue={handleCreateVenue}
          onUpdateVenue={handleUpdateVenue}
          onUpdateVenueLinkApproval={handleUpdateVenueLinkApproval}
          loadingCreate={loadingCreate}
          error={venuesError}
        />
      ) : null}

      {isAdminUser && activeTab === 'link-requests' ? (
        <AdminLinkRequestsPage
          requests={linkRequests}
          loadingRequests={loadingLinkRequests}
          requestsError={linkRequestsError}
          requestsStatus={linkRequestsStatus}
          onChangeStatus={setLinkRequestsStatus}
          onRefresh={() => loadLinkRequests(linkRequestsStatus)}
          onUpdateVenueLinkApproval={handleUpdateVenueLinkApproval}
          loadingApproval={loadingCreate}
        />
      ) : null}

      {isAdminUser && activeTab === 'support-tickets' ? <AdminSupportTicketsPage /> : null}

      {isEstablishmentUser && activeTab === 'establishment-profile' ? <EstablishmentPanelPage /> : null}

      {isEstablishmentUser && activeTab === 'establishment-support' ? <EstablishmentSupportTicketsPage /> : null}

      {isEstablishmentUser && activeTab === 'establishment-agenda' ? (
        <EstablishmentAgendaPage hasApprovedLink={establishmentHasApprovedLink} />
      ) : null}

      {isEstablishmentUser && activeTab === 'establishment-stats' ? (
        <EstablishmentAgendaStatsPage hasApprovedLink={establishmentHasApprovedLink} />
      ) : null}
    </AdminShell>
  );
}
