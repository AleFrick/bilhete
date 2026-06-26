import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from './api/client';
import AppShell from './layout/AppShell';
import AuthPage from './pages/AuthPage';
import BilhetesPage from './pages/BilhetesPage';
import ChatsPage from './pages/ChatsPage';
import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import ProfilePage from './pages/ProfilePage';
import { clearSession, loadUser, persistSession } from './state/session';

const DEFAULT_NEARBY_RADIUS_KM = 20;

function resolveRouteForRole(user) {
  if (user?.role === 'admin') {
    return '/admin';
  }

  if (user?.role === 'establishment') {
    return '/admin/establishment';
  }

  return '/app';
}

function redirectToRoleRoute(user) {
  const targetRoute = resolveRouteForRole(user);
  if (window.location.pathname !== targetRoute) {
    window.location.replace(targetRoute);
  }
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [activeTab, setActiveTab] = useState('home');

  const [me, setMe] = useState(loadUser());
  const [venues, setVenues] = useState([]);
  const [radar, setRadar] = useState([]);
  const [currentCheckin, setCurrentCheckin] = useState(null);
  const [people, setPeople] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);

  const [loadingVenues, setLoadingVenues] = useState(false);
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [locationBlockedMessage, setLocationBlockedMessage] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [showAuthForm, setShowAuthForm] = useState(window.location.pathname !== '/');
  const locationCacheRef = useRef({ resolved: false, value: null });

  const decodeBase64UrlJson = (value) => {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`;
    return JSON.parse(atob(padded));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const socialToken = params.get('social_token');
    const socialUserRaw = params.get('social_user');
    const socialError = params.get('social_error');

    if (!socialToken && !socialUserRaw && !socialError) {
      return;
    }

    if (socialError) {
      setGlobalError(socialError);
    } else {
      try {
        const parsedUser = decodeBase64UrlJson(socialUserRaw);
        persistSession(socialToken, parsedUser);
        setMe(parsedUser);
      } catch {
        setGlobalError('Nao foi possivel concluir o login social.');
      }
    }

    params.delete('social_token');
    params.delete('social_user');
    params.delete('social_error');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, []);

  const isAuthenticated = Boolean(me?.id);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    redirectToRoleRoute(me);
  }, [isAuthenticated, me]);

  const getBrowserLocation = () =>
    new Promise((resolve) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        resolve({ coords: null, blocked: true });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            coords: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            blocked: false,
          });
        },
        () => resolve({ coords: null, blocked: true }),
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 120000,
        }
      );
    });

  const getCachedLocation = async () => {
    if (locationCacheRef.current.resolved) {
      return locationCacheRef.current.value;
    }

    const location = await getBrowserLocation();
    locationCacheRef.current = {
      resolved: true,
      value: location,
    };

    return location;
  };

  const loadBootstrapData = async () => {
    setGlobalError('');

    try {
      setLoadingVenues(true);
      const locationResult = await getCachedLocation();
      const location = locationResult?.coords || null;
      const hasLocation = Boolean(location);

      setLocationEnabled(hasLocation);
      setLocationBlockedMessage(
        hasLocation
          ? ''
          : 'Sem localizacao ativa, o Bilhete perde a magia dos encontros por perto. Ative a permissao para liberar uma experiencia completa.'
      );

      const venuesPromise = hasLocation
        ? api.venues(location, DEFAULT_NEARBY_RADIUS_KM)
        : Promise.resolve([]);
      const [meData, venuesData, checkinData, inboxData, outboxData, chatsData] = await Promise.all([
        api.me(),
        venuesPromise,
        api.currentCheckin(),
        api.bilhetesInbox(),
        api.bilhetesOutbox(),
        api.chats(),
      ]);

      setMe(meData);
      localStorage.setItem('bilhete.user', JSON.stringify(meData));
      setVenues(venuesData);
      setCurrentCheckin(checkinData);
      setInbox(inboxData);
      setOutbox(outboxData);
      setChats(chatsData);

      if (meData?.premiumStatus) {
        setLoadingRadar(true);
        try {
          const radarData = await api.radar();
          setRadar(radarData);
        } catch (error) {
          setRadar([]);
        } finally {
          setLoadingRadar(false);
        }
      } else {
        setRadar([]);
      }
    } catch (error) {
      setGlobalError(error.message);
      clearSession();
      setMe(null);
    } finally {
      setLoadingVenues(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadBootstrapData();
    }
  }, [isAuthenticated]);

  const handleLogin = async (payload) => {
    setAuthLoading(true);
    setGlobalError('');

    try {
      const data = await api.login(payload);
      persistSession(data.token, data.user);
      setMe(data.user);
      redirectToRoleRoute(data.user);
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (payload) => {
    setAuthLoading(true);
    setGlobalError('');

    try {
      const data = await api.register(payload);
      persistSession(data.token, data.user);
      setMe(data.user);
      redirectToRoleRoute(data.user);
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSocialLogin = ({ provider }) => {
    setGlobalError('');
    const url = api.socialStartUrl(provider);
    window.location.assign(url);
  };

  const handleLogout = () => {
    clearSession();
    setMe(null);
    setVenues([]);
    setRadar([]);
    setCurrentCheckin(null);
    setPeople([]);
    setInbox([]);
    setOutbox([]);
    setChats([]);
    setMessages([]);
    setSelectedChatId(null);
    setActiveTab('home');
  };

  const handleLoadPeople = async (venueId) => {
    setLoadingPeople(true);
    setGlobalError('');
    setPeople([]);
    try {
      const data = await api.venuePeople(venueId);
      setPeople(data.filter((person) => person.id !== me.id));
    } catch (error) {
      setGlobalError(error.message);
      setPeople([]);
    } finally {
      setLoadingPeople(false);
    }
  };

  const handleCheckin = async (venueId) => {
    setGlobalError('');
    try {
      await api.checkin(venueId);
      const data = await api.currentCheckin();
      setCurrentCheckin(data);
      await loadBootstrapData();
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const handleCheckout = async () => {
    setGlobalError('');
    try {
      await api.checkout();
      setCurrentCheckin(null);
      setPeople([]);
      await loadBootstrapData();
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const handleSendBilhete = async (payload) => {
    setGlobalError('');
    try {
      await api.sendBilhete(payload);
      const [newInbox, newOutbox] = await Promise.all([api.bilhetesInbox(), api.bilhetesOutbox()]);
      setInbox(newInbox);
      setOutbox(newOutbox);
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const handleRespondBilhete = async (id, action) => {
    setGlobalError('');
    try {
      await api.respondBilhete(id, action);
      const [newInbox, newChats] = await Promise.all([api.bilhetesInbox(), api.chats()]);
      setInbox(newInbox);
      setChats(newChats);
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const handleSelectChat = async (chatId) => {
    setSelectedChatId(chatId);
    setGlobalError('');

    try {
      const data = await api.messages(chatId);
      setMessages(data);
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const handleSendMessage = async (chatId, text) => {
    setGlobalError('');

    try {
      await api.sendMessage(chatId, text);
      const data = await api.messages(chatId);
      setMessages(data);
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const handleSaveProfile = async (payload) => {
    setGlobalError('');
    try {
      const data = await api.updateMe(payload);
      setMe(data);
      localStorage.setItem('bilhete.user', JSON.stringify(data));
    } catch (error) {
      setGlobalError(error.message);
    }
  };

  const content = useMemo(() => {
    if (activeTab === 'home') {
      return (
        <HomePage
          venues={venues}
          radar={radar}
          loadingVenues={loadingVenues}
          loadingRadar={loadingRadar}
          locationEnabled={locationEnabled}
          locationBlockedMessage={locationBlockedMessage}
          premiumActive={Boolean(me?.premiumStatus)}
          currentCheckin={currentCheckin}
          people={people}
          loadingPeople={loadingPeople}
          onCheckin={handleCheckin}
          onCheckout={handleCheckout}
          onLoadPeople={handleLoadPeople}
          onSendBilhete={handleSendBilhete}
        />
      );
    }

    if (activeTab === 'bilhetes') {
      return <BilhetesPage inbox={inbox} outbox={outbox} onRespond={handleRespondBilhete} />;
    }

    if (activeTab === 'chats') {
      return (
        <ChatsPage
          chats={chats}
          messages={messages}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onSendMessage={handleSendMessage}
          currentUserId={me?.id}
        />
      );
    }

    return <ProfilePage me={me} onSave={handleSaveProfile} />;
  }, [
    activeTab,
    chats,
    currentCheckin,
    inbox,
    loadingPeople,
    loadingRadar,
    loadingVenues,
    me,
    messages,
    outbox,
    people,
    radar,
    selectedChatId,
    venues,
  ]);

  if (!isAuthenticated) {
    if (window.location.pathname === '/' && !showAuthForm) {
      return (
        <LandingPage
          onCreateAccount={() => {
            setAuthMode('register');
            setShowAuthForm(true);
          }}
          onEnter={() => {
            setAuthMode('login');
            setShowAuthForm(true);
          }}
        />
      );
    }

    return (
      <AuthPage
        onLogin={handleLogin}
        onRegister={handleRegister}
        onSocialLogin={handleSocialLogin}
        loading={authLoading}
        error={globalError}
        initialMode={authMode}
      />
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
      premiumActive={Boolean(me?.premiumStatus)}
    >
      {globalError ? <p className="global-error">{globalError}</p> : null}
      {content}
    </AppShell>
  );
}
