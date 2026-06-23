import { useState } from 'react';

export default function AuthPage({ onLogin, onRegister, loading, error }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

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

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' ? (
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
              minLength={mode === 'login' ? 3 : 6}
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
          onClick={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
        >
          {mode === 'login' ? 'Nao tem conta? Criar agora' : 'Ja tem conta? Entrar'}
        </button>
      </section>
    </main>
  );
}
