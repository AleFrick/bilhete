import { useState } from 'react';

import { api } from '../api/client';
import AppNotice from '../components/AppNotice';

export default function ResetPasswordPage({ token: initialToken, onSuccess }) {
  const [token] = useState(initialToken || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const computePasswordStrengthScore = (pwd) => {
    const value = String(pwd || '');
    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  };

  const minPasswordStrength = Number(import.meta.env.VITE_PASSWORD_MIN_STRENGTH || 2);
  const passwordStrength = computePasswordStrengthScore(password);
  const progressTowardsGoal = minPasswordStrength > 0 ? passwordStrength / minPasswordStrength : 0;
  const barWidthPercent =
    passwordStrength >= minPasswordStrength ? 100 : Math.max(8, Math.min(100, progressTowardsGoal * 100));
  const warningThreshold = Math.max(1, minPasswordStrength - 1);
  const passwordStrengthColor =
    passwordStrength >= minPasswordStrength
      ? '#16a34a'
      : passwordStrength >= warningThreshold
        ? '#eab308'
        : '#dc2626';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Token de recuperacao ausente ou invalido.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao conferem.');
      return;
    }

    if (passwordStrength < minPasswordStrength) {
      setError('Sua senha ainda nao atende os criterios de seguranca.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess('Senha redefinida com sucesso! Voce ja pode entrar normalmente.');
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = '/app';
        }
      }, 2000);
    } catch (err) {
      setError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="hero__tag">Bilhete</p>
        <h1>Redefinir senha</h1>
        <p className="auth-subtitle">Defina uma nova senha para sua conta.</p>

        <AppNotice message={error} type="error" onClose={() => setError('')} />
        <AppNotice message={success} type="success" onClose={() => setSuccess('')} />

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          <label>
            Nova senha
            <input
              type="password"
              name="user_reset_password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>

          <div>
            <label>
              Confirmar senha
              <input
                type="password"
                name="user_reset_confirm_password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
          </div>

          <div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={passwordStrength}
              aria-label="Forca da senha"
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.14)',
                overflow: 'hidden',
                marginTop: '4px',
              }}
            >
              <div
                style={{
                  width: `${barWidthPercent}%`,
                  height: '100%',
                  background: passwordStrengthColor,
                  transition: 'width 180ms ease, background-color 180ms ease',
                }}
              />
            </div>
          </div>

          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </form>
      </section>
    </main>
  );
}
