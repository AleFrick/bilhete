const navItems = [{ key: 'venues', label: 'Cadastro de locais' }];

export default function AdminShell({ activeTab, onTabChange, onLogout, adminName, children }) {
  return (
    <div className="admin-shell">
      <aside className="admin-shell__sidebar">
        <div className="admin-brand">
          <p className="admin-brand__eyebrow">Bilhete</p>
          <h1>Painel Admin</h1>
        </div>

        <nav className="admin-nav" aria-label="Navegacao administrativa">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-nav__item ${activeTab === item.key ? 'is-active' : ''}`}
              onClick={() => onTabChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="admin-shell__content">
        <header className="admin-topbar">
          <div>
            <p className="admin-topbar__label">Conectado como</p>
            <strong>{adminName || 'Administrador'}</strong>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onLogout}>
            Sair
          </button>
        </header>

        <main className="admin-main">{children}</main>
      </section>
    </div>
  );
}
