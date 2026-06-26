import { useEffect, useState } from 'react';

export default function AuthPage({
  onLogin,
  onRegister,
  onSocialLogin,
  loading,
  error,
  initialMode = 'login',
}) {
  const [mode, setMode] = useState(initialMode === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const googleEnabled = import.meta.env.VITE_AUTH_GOOGLE_ENABLED === 'true';
  const icloudEnabled = import.meta.env.VITE_AUTH_ICLOUD_ENABLED === 'true';
  const facebookEnabled = import.meta.env.VITE_AUTH_FACEBOOK_ENABLED === 'true';
  const hasSocialProviders = googleEnabled || icloudEnabled || facebookEnabled;

  useEffect(() => {
    const normalizedMode = initialMode === 'register' ? 'register' : 'login';
    setMode(normalizedMode);
    setForm({ name: '', email: '', password: '' });
  }, [initialMode]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (mode === 'login') {
      onLogin({ email: form.email, password: form.password });
      return;
    }

    onRegister(form);
  };

  const handleSocialClick = async (provider) => {
    if (!onSocialLogin) {
      return;
    }

    await onSocialLogin({ provider });
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="hero__tag">Bilhete</p>
        <h1>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
        <p className="auth-subtitle">Conecte pessoas no mesmo lugar com seguranca e contexto.</p>

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          {mode === 'register' ? (
            <label>
              Nome
              <input
                name="user_register_name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                autoComplete="off"
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              type="email"
              name={mode === 'login' ? 'user_login_email' : 'user_register_email'}
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
              autoComplete="off"
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              name={mode === 'login' ? 'user_login_password' : 'user_register_password'}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
              minLength={mode === 'login' ? 3 : 6}
              autoComplete="new-password"
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Enviando...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        {hasSocialProviders ? (
          <div className="auth-social">
            <p className="auth-social__label">Ou entre com</p>
            <div className="auth-social__buttons">
              {googleEnabled ? (
            <button
              type="button"
              className="btn btn--ghost auth-social__btn"
              onClick={() => handleSocialClick('google')}
              disabled={loading}
              aria-label="Entrar com Google"
              title="Entrar com Google"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-social__icon auth-social__icon--google">
                <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.7 3.1-4.2 3.1-7.5Z" />
                <path d="M12 22c2.7 0 5-0.9 6.7-2.5l-3.2-2.6c-0.9 0.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.7A10 10 0 0 0 12 22Z" />
                <path d="M6.2 13.6A6 6 0 0 1 6 12c0-.6.1-1.1.2-1.6V7.7H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1.9 4.3l3.3-2.7Z" />
                <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 12 2a10 10 0 0 0-9.1 5.7l3.3 2.7C7 7.8 9.3 6 12 6Z" />
              </svg>
              <span className="auth-social__btn-label">Google</span>
            </button>
              ) : null}

              {icloudEnabled ? (
            <button
              type="button"
              className="btn btn--ghost auth-social__btn"
              onClick={() => handleSocialClick('icloud')}
              disabled={loading}
              aria-label="Entrar com iCloud"
              title="Entrar com iCloud"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-social__icon auth-social__icon--icloud">
                <path d="M16.2 12.3c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.2.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.6 2.1-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.8-1.2 1.1-2.5 1.1-2.6 0 0-2.5-1-2.5-3.6ZM14.1 5.9c.6-.8 1.1-1.9.9-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.9-1 2.9 1 .1 2.1-.5 2.8-1.3Z" />
              </svg>
              <span className="auth-social__btn-label">iCloud</span>
            </button>
              ) : null}

              {facebookEnabled ? (
            <button
              type="button"
              className="btn btn--ghost auth-social__btn"
              onClick={() => handleSocialClick('facebook')}
              disabled={loading}
              aria-label="Entrar com Facebook"
              title="Entrar com Facebook"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-social__icon auth-social__icon--facebook">
                <path d="M13.5 21v-8h2.6l.4-3h-3v-1.9c0-.9.3-1.5 1.6-1.5h1.7V4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V10H8v3h2.4v8h3.1Z" />
              </svg>
              <span className="auth-social__btn-label">Facebook</span>
            </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="auth-links">
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setMode((prev) => (prev === 'login' ? 'register' : 'login'));
              setForm({ name: '', email: '', password: '' });
            }}
          >
            {mode === 'login' ? 'Nao tem conta? Criar agora' : 'Ja tem conta? Entrar'}
          </button>
        </div>
      </section>
    </main>
  );
}
