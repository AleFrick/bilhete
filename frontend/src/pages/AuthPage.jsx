import { useEffect, useState } from 'react';

export default function AuthPage({ onLogin, onRegister, loading, error, initialMode = 'login', onBack }) {
  const [mode, setMode] = useState(initialMode === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

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

        {onBack ? (
          <button type="button" className="text-link" onClick={onBack}>
            Voltar para a landing
          </button>
        ) : null}
      </section>
    </main>
  );
}
