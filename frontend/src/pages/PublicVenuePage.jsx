import { useEffect, useState } from 'react';

import { api } from '../api/client';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';

export default function PublicVenuePage({ venueId, onGoToApp }) {
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await api.publicVenue(venueId);
        if (!cancelled) {
          setVenue(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Nao foi possivel carregar este local.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  if (loading) {
    return <PageLoader label="Carregando local..." />;
  }

  if (error) {
    return (
      <div className="page-stack" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState
          icon="😕"
          title="Local nao encontrado"
          message={error}
          action={
            <button type="button" className="btn btn--primary" onClick={onGoToApp}>
              Ir para o Bilhete
            </button>
          }
        />
      </div>
    );
  }

  if (!venue) {
    return null;
  }

  return (
    <div className="page-stack" style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: '480px', margin: '0 auto' }}>
      <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
        {venue.establishmentLogoUrl ? (
          <img
            src={venue.establishmentLogoUrl}
            alt={`Logo de ${venue.name}`}
            style={{ width: '72px', height: '72px', borderRadius: '16px', objectFit: 'cover', marginBottom: '16px' }}
          />
        ) : (
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '16px',
              background: 'var(--accent-soft, rgba(255,45,85,0.14))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: 700,
              margin: '0 auto 16px',
            }}
          >
            {String(venue.name || '?').charAt(0).toUpperCase()}
          </div>
        )}

        <h1 style={{ margin: '0 0 8px', fontSize: '1.4rem' }}>{venue.name}</h1>

        {venue.address ? (
          <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: 'var(--muted)' }}>{venue.address}</p>
        ) : null}

        {venue.category ? (
          <span className="pill" style={{ marginBottom: '16px', display: 'inline-block' }}>
            {venue.category}
          </span>
        ) : null}

        {venue.description ? (
          <p style={{ margin: '16px 0', fontSize: '0.9rem', lineHeight: 1.5 }}>{venue.description}</p>
        ) : null}

        {venue.contactPhone ? (
          <p style={{ margin: '8px 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
            Telefone: {venue.contactPhone}
          </p>
        ) : null}
      </div>

      {Array.isArray(venue.galleryUrls) && venue.galleryUrls.length > 0 ? (
        <div className="panel" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Fotos</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
            {venue.galleryUrls.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Foto ${index + 1} de ${venue.name}`}
                style={{ width: '100%', borderRadius: '8px', aspectRatio: '1', objectFit: 'cover' }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {Array.isArray(venue.agendaEvents) && venue.agendaEvents.length > 0 ? (
        <div className="panel" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Agenda</h3>
          <ul className="simple-list">
            {venue.agendaEvents.map((event) => (
              <li key={event.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <strong>{event.title}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '4px 0 0' }}>
                  {event.eventDate ? new Date(event.eventDate).toLocaleDateString('pt-BR') : ''}
                  {event.startTime ? ` as ${event.startTime}` : ''}
                </p>
                {event.information ? <p style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>{event.information}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Conheca o Bilhete</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '16px' }}>
          Faca check-in neste local, encontre pessoas por perto e troque bilhetes. Baixe o Bilhete e comece a usar!
        </p>
        <button type="button" className="btn btn--primary btn--full" onClick={onGoToApp}>
          Entrar no Bilhete
        </button>
      </div>
    </div>
  );
}
