import { useState } from 'react';

import AppNotice from './AppNotice';

function computePasswordStrengthScore(password) {
  const value = String(password || '');
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

export default function ChangePasswordForm({ apiClient }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const minPasswordStrength = Number(import.meta.env.VITE_PASSWORD_MIN_STRENGTH || 2);
  const passwordStrength = computePasswordStrengthScore(newPassword);
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
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('As novas senhas nao conferem.');
      return;
    }

    if (passwordStrength < minPasswordStrength) {
      setError('Sua nova senha ainda nao atende os criterios de seguranca.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      setSuccess('Senha alterada com sucesso.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ maxWidth: '100%' }}>
      <AppNotice message={error} type="error" onClose={() => setError('')} />
      <AppNotice message={success} type="success" onClose={() => setSuccess('')} />

      <label>
        Senha atual
        <input
          type="password"
          name="user_change_current_password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          minLength={1}
          autoComplete="current-password"
        />
      </label>

      <label>
        Nova senha
        <input
          type="password"
          name="user_change_new_password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </label>

      <div>
        <label>
          Confirmar nova senha
          <input
            type="password"
            name="user_change_confirm_password"
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
          aria-label="Forca da nova senha"
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
        {loading ? 'Alterando...' : 'Alterar senha'}
      </button>
    </form>
  );
}
