import { useMemo, useState } from 'react';

import ExplorePage from './ExplorePage';

export default function HomePage({
  venues,
  radar,
  loadingVenues,
  loadingRadar,
  locationEnabled,
  locationBlockedMessage,
  premiumActive,
  currentCheckin,
  people,
  loadingPeople,
  onCheckin,
  onCheckout,
  onLoadPeople,
  onSendBilhete,
}) {
  const [hotspotFilter, setHotspotFilter] = useState('');
  const radarByVenueId = new Map(radar.map((item) => [item.id, item]));
  const filteredVenues = useMemo(() => {
    if (!premiumActive) {
      return venues;
    }

    const normalizedFilter = hotspotFilter.trim().toLowerCase();
    if (!normalizedFilter) {
      return venues;
    }

    return venues.filter((venue) => {
      const searchable = `${venue.name || ''} ${venue.address || ''}`.toLowerCase();
      return searchable.includes(normalizedFilter);
    });
  }, [hotspotFilter, premiumActive, venues]);

  return (
    <div className="page-stack">
      <section className="panel">
        <h3>Hotspots</h3>
        {loadingVenues ? <p>Carregando locais...</p> : null}
        {!loadingVenues && !locationEnabled ? (
          <p className="explore-notice">
            {locationBlockedMessage ||
              'Sem localizacao ativa, o Bilhete perde a magia dos encontros por perto. Ative a permissao para liberar uma experiencia completa.'}
          </p>
        ) : null}
        {premiumActive && loadingRadar ? <p>Atualizando pessoas no local...</p> : null}
        {premiumActive && locationEnabled ? (
          <label className="explore-filter">
            <input
              placeholder="Buscar local por nome ou endereco..."
              value={hotspotFilter}
              onChange={(event) => setHotspotFilter(event.target.value)}
            />
          </label>
        ) : null}
        {locationEnabled ? (
          <ul className="simple-list">
            {filteredVenues.map((venue) => {
            const activePeopleValue = Number.parseInt(
              radarByVenueId.get(venue.id)?.activePeople ?? 0,
              10
            );
            const activePeople = Number.isNaN(activePeopleValue) ? 0 : activePeopleValue;
            const isCurrentVenue = currentCheckin?.venueId === venue.id;

            return (
              <li key={venue.id}>
                <div>
                  <strong>{venue.name}</strong>
                  <p>{venue.address || 'Endereco nao informado'}</p>
                  {Number.isFinite(venue.distanceKm) ? <p>{venue.distanceKm} km de voce</p> : null}
                  {premiumActive ? (
                    <p className="hotspot-presence">
                      <span className="hotspot-presence__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.14 0-7.5 2.52-7.5 5.63A1.12 1.12 0 0 0 5.63 21h12.74a1.12 1.12 0 0 0 1.13-1.12c0-3.11-3.36-5.63-7.5-5.63Z" />
                        </svg>
                      </span>
                      <span>{activePeople}</span>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`btn ${isCurrentVenue ? 'btn--ghost' : 'btn--primary'} hotspot-checkin`}
                  onClick={() => onCheckin(venue.id)}
                  disabled={Boolean(currentCheckin && !isCurrentVenue)}
                  aria-label={isCurrentVenue ? `Check-in ativo em ${venue.name}` : `Fazer check-in em ${venue.name}`}
                  title={isCurrentVenue ? 'Voce ja entrou neste local' : 'Entrar no local'}
                >
                  <span className="hotspot-checkin__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h10A1.5 1.5 0 0 1 16 3.5V9h-2V4H5v16h9V15h2v5.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 20.5v-17Zm15.22 5.72 2.78 2.78-2.78 2.78-1.06-1.06 0.97-0.97H10v-1.5h8.13l-0.97-0.97 1.06-1.06Z" />
                    </svg>
                  </span>
                </button>
              </li>
            );
            })}
          </ul>
        ) : null}
        {locationEnabled && premiumActive && !loadingVenues && !filteredVenues.length ? (
          <p>Nenhum local encontrado para este filtro.</p>
        ) : null}
      </section>

      <ExplorePage
        venues={venues}
        currentCheckin={currentCheckin}
        people={people}
        loadingPeople={loadingPeople}
        onCheckin={onCheckin}
        onCheckout={onCheckout}
        onLoadPeople={onLoadPeople}
        onSendBilhete={onSendBilhete}
        locationEnabled={locationEnabled}
        locationBlockedMessage={locationBlockedMessage}
        hideVenueList
      />
    </div>
  );
}
