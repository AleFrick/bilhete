import { useMemo, useState } from 'react';

export default function ShareVenueModal({ venue, onClose }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (!venue?.id) return '';
    const base = window.location.origin;
    return `${base}/venue/${venue.id}`;
  }, [venue?.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: venue?.name || 'Bilhete',
          text: `Encontrei ${venue?.name} no Bilhete!`,
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  const qrCodeUrl = useMemo(() => {
    if (!shareUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}`;
  }, [shareUrl]);

  if (!venue) return null;

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Compartilhar local">
      <div className="panel admin-overlay__content" style={{ maxWidth: '380px', textAlign: 'center' }}>
        <div className="admin-overlay__header">
          <h2>Compartilhar local</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Fechar</button>
        </div>

        <div style={{ padding: '16px' }}>
          {venue.establishmentLogoUrl ? (
            <img
              src={venue.establishmentLogoUrl}
              alt={`Logo de ${venue.name}`}
              style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', marginBottom: '12px' }}
            />
          ) : null}
          <h3 style={{ margin: '0 0 4px' }}>{venue.name}</h3>
          {venue.address ? (
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--muted)' }}>{venue.address}</p>
          ) : null}

          <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', display: 'inline-block', marginBottom: '16px' }}>
            <img
              src={qrCodeUrl}
              alt="QR Code do link de compartilhamento"
              style={{ width: '200px', height: '200px', display: 'block' }}
            />
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '12px' }}>
            Escaneie o QR code ou copie o link para compartilhar este local.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn--primary" onClick={handleNativeShare}>
              Compartilhar
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleCopy}>
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '12px', wordBreak: 'break-all' }}>
            {shareUrl}
          </p>
        </div>
      </div>
    </div>
  );
}
