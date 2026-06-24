import { useEffect, useState } from 'react';

const defaultNavItems = [{ key: 'venues', label: 'Cadastro de locais' }];

export default function AdminShell({
  activeTab,
  onTabChange,
  onLogout,
  adminName,
  children,
  title = 'Painel Admin',
  navItems = defaultNavItems,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.innerWidth >= 980;
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth < 980;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < 980);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleTabChange = (tabKey) => {
    onTabChange(tabKey);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={`admin-shell ${sidebarOpen ? 'is-sidebar-open' : 'is-sidebar-collapsed'}`}>
      {isMobile && sidebarOpen ? (
        <button
          type="button"
          className="admin-shell__backdrop"
          aria-label="Fechar menu lateral"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className="admin-shell__sidebar" aria-hidden={isMobile && !sidebarOpen}>
        <div className="admin-brand">
          <h1 className="admin-brand__logo">Bilhete</h1>
          {title ? <p className="admin-brand__subtitle">{title}</p> : null}
        </div>

        {navItems.length ? (
          <nav className="admin-nav" aria-label="Navegacao administrativa">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`admin-nav__item ${activeTab === item.key ? 'is-active' : ''}`}
                onClick={() => handleTabChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
      </aside>

      <section className="admin-shell__content">
        <header className="admin-topbar">
          <button
            type="button"
            className="btn btn--ghost admin-topbar__menu"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
            aria-expanded={sidebarOpen}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-topbar__menu-icon">
              {sidebarOpen ? (
                <path d="M14.41 7.41 13 6l-6 6 6 6 1.41-1.41L9.83 12z" />
              ) : (
                <path d="m9.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L14.17 12z" />
              )}
            </svg>
          </button>
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
