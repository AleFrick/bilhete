import { useEffect, useState } from 'react';

export default function AdminLoginPage({ loading, error, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setEmail('');
    setPassword('');
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onLogin({ email, password });
  };

  return (
    <div className="admin-auth-page">
      <section className="admin-auth-card">
        <p className="hero__tag">Area Restrita</p>
        <h1>Painel Bilhete</h1>
        <p className="auth-subtitle">Entre com sua conta de administrador ou estabelecimento para acessar o painel.</p>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <label>
            Email
            <input
              type="email"
              name="admin_login_email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="off"
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              name="admin_login_password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar no painel'}
          </button>
        </form>
      </section>
    </div>
  );
}
