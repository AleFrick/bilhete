import { useEffect, useState } from 'react';

import { api } from '../api/client';

export default function TermsModal({ open, onClose, onAccept, required = false }) {
  const [terms, setTerms] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setAccepted(false);
    api
      .getActiveTerms()
      .then((data) => {
        setTerms(data?.hasTerms ? data.terms : null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open]);

  const handleAccept = async () => {
    setAccepting(true);
    setError('');
    try {
      await api.acceptTerms();
      setAccepted(true);
      if (onAccept) onAccept();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Termos de uso e privacidade">
      <div className="panel admin-overlay__content" style={{ maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="admin-overlay__header">
          <h2>{terms?.title || 'Termos de Uso e Privacidade'}</h2>
          {!required ? (
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Fechar
            </button>
          ) : null}
        </div>

        {loading ? (
          <p style={{ opacity: 0.6 }}>Carregando termos...</p>
        ) : error ? (
          <p style={{ color: '#dc2626' }}>{error}</p>
        ) : terms ? (
          <>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                opacity: 0.85,
                marginBottom: '20px',
              }}
            >
              {terms.body}
            </div>

            {required ? (
              <>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '16px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    style={{ marginTop: '3px', width: '18px', height: '18px' }}
                  />
                  <span>
                    Li e aceito os <strong>Termos de Uso</strong> e a{' '}
                    <strong>Politica de Privacidade (LGPD)</strong> do Bilhete.
                  </span>
                </label>

                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!accepted || accepting}
                  onClick={handleAccept}
                >
                  {accepting ? 'Registrando...' : 'Aceitar e continuar'}
                </button>
              </>
            ) : null}
          </>
        ) : (
          <p style={{ opacity: 0.6 }}>Nenhum termo ativo no momento.</p>
        )}
      </div>
    </div>
  );
}
