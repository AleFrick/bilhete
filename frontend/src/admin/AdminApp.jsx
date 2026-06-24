import { useEffect, useState } from 'react';

import { adminApi } from './api/adminClient';
import AdminShell from './layout/AdminShell';
import AdminLoginPage from './pages/AdminLoginPage';
import EstablishmentPanelPage from './pages/EstablishmentPanelPage';
import AdminLinkRequestsPage from './pages/AdminLinkRequestsPage';
import AdminVenuesPage from './pages/AdminVenuesPage';
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

  const isAuthenticated = Boolean(adminUser?.id);
  const isAdminUser = adminUser?.role === 'admin';
  const isEstablishmentUser = adminUser?.role === 'establishment';

  useEffect(() => {
    if (isAdminUser) {
      setActiveTab((prev) => (prev === 'venues' || prev === 'link-requests' ? prev : 'venues'));
      return;
    }

    if (isEstablishmentUser) {
      setActiveTab((prev) => (prev === 'establishment-profile' ? prev : 'establishment-profile'));
    }
  }, [isAdminUser, isEstablishmentUser]);

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

  if (!isAuthenticated) {
    return <AdminLoginPage loading={authLoading} error={authError} onLogin={handleLogin} />;
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
              { key: 'venues', label: 'Cadastro de locais' },
              { key: 'link-requests', label: 'Pedidos de vinculacao' },
            ]
          : [{ key: 'establishment-profile', label: 'Cadastro' }]
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

      {isEstablishmentUser && activeTab === 'establishment-profile' ? <EstablishmentPanelPage /> : null}
    </AdminShell>
  );
}
