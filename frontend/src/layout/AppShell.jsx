import { useState, useRef, useEffect } from 'react';

const tabs = [
  { key: 'home', label: 'Explorar' },
  { key: 'premium', label: 'Premium' },
  { key: 'bilhetes', label: 'Bilhetes' },
  { key: 'chats', label: 'Conversas' },
  { key: 'profile', label: 'Perfil' },
];

export default function AppShell({ activeTab, onTabChange, onLogout, children, premiumActive, unreadCount = 0, notifications = [], onMarkNotificationsRead }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = () => {
    const newOpen = !notifOpen;
    setNotifOpen(newOpen);
    if (newOpen && unreadCount > 0 && onMarkNotificationsRead) {
      onMarkNotificationsRead();
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <p className="topbar__eyebrow">Bilhete</p>
          {premiumActive ? (
            <span className="topbar__premium-badge" title="Premium ativo">✦ Premium</span>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleBellClick}
            style={{ position: 'relative', padding: '6px 10px', display: 'inline-flex', alignItems: 'center' }}
            aria-label="Notificacoes"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>
          {notifOpen ? (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '320px',
                maxHeight: '400px',
                overflowY: 'auto',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                zIndex: 100,
                padding: '8px',
              }}
            >
              {notifications.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: '0.85rem' }}>
                  Sem notificacoes.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--line)',
                      opacity: n.isRead ? 0.6 : 1,
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{n.title}</p>
                    {n.body ? (
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>{n.body}</p>
                    ) : null}
                    <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: 'var(--muted)', opacity: 0.6 }}>
                      {new Date(n.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <main className="shell-content">{children}</main>

      <nav className="bottom-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`bottom-tabs__item ${activeTab === tab.key ? 'is-active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
