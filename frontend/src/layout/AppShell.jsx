const tabs = [
  { key: 'home', label: 'Home' },
  { key: 'explore', label: 'Explorar' },
  { key: 'bilhetes', label: 'Bilhetes' },
  { key: 'chats', label: 'Conversas' },
  { key: 'profile', label: 'Perfil' },
];

export default function AppShell({ activeTab, onTabChange, onLogout, children, premiumActive }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <p className="topbar__eyebrow">Bilhete</p>
          {premiumActive ? <span className="topbar__premium-badge" title="Premium ativo">★</span> : null}
        </div>
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          Sair
        </button>
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
