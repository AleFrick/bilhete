import { useEffect, useState } from 'react';

import { adminApi } from './api/adminClient';
import AdminShell from './layout/AdminShell';
import AdminLoginPage from './pages/AdminLoginPage';
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

  const isAuthenticated = Boolean(adminUser?.id);

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

  useEffect(() => {
    if (isAuthenticated) {
      loadCities();
    }
  }, [isAuthenticated]);

  const handleLogin = async (payload) => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const data = await adminApi.login(payload);
      persistAdminSession(data.token, data.user);
      setAdminUser(data.user);
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

  if (!isAuthenticated) {
    return <AdminLoginPage loading={authLoading} error={authError} onLogin={handleLogin} />;
  }

  return (
    <AdminShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
      adminName={adminUser?.name}
    >
      {activeTab === 'venues' ? (
        <AdminVenuesPage
          cities={cities}
          loadingCities={loadingCities}
          venues={venues}
          loadingVenues={loadingVenues}
          onSearchVenues={loadVenues}
          onCreateVenue={handleCreateVenue}
          onUpdateVenue={handleUpdateVenue}
          loadingCreate={loadingCreate}
          error={venuesError}
        />
      ) : null}
    </AdminShell>
  );
}
