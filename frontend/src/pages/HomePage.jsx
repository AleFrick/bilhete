import { useMemo, useState, useEffect } from 'react';

import ExplorePage from './ExplorePage';
import Modal from '../components/Modal';
import RestaurantMenuPreview from '../components/RestaurantMenuPreview';
import VenuePhotosModal from '../components/VenuePhotosModal';
import VenueAgendaModal from '../components/VenueAgendaModal';
import { api } from '../api/client';

const VENUE_CATEGORY_LABELS = {
  bar: 'Bar',
  pub: 'Pub',
  balada: 'Balada',
  show: 'Show',
  cafeteria: 'Cafeteria',
  restaurante: 'Restaurante',
  praca: 'Praca',
  evento: 'Evento',
};

const CATEGORY_ICONS = {
  bar: (
    <svg viewBox="0 0 24 24" className="category-icon" aria-hidden="true">
      <path d="M7 2a1 1 0 0 0-1 1v3h2V3a1 1 0 0 0-1-1Zm10 0a1 1 0 0 0-1 1v3h2V3a1 1 0 0 0-1-1Zm-5 0a1 1 0 0 0-1 1v3h2V3a1 1 0 0 0-1-1Zm-3 6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2v3h2v-3h6v3h2v-3h2a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H9Zm0 2h10v8H9v-8Z" />
    </svg>
  ),
  pub: (
    <svg viewBox="0 0 24 24" className="category-icon" aria-hidden="true">
      <path d="M5 2a1 1 0 0 0-1 1v8a5 5 0 1 0 10 0V3a1 1 0 0 0-1-1H5Zm5 11a3 3 0 0 1-3-3V4h6v6a3 3 0 0 1-3 3Zm8-2a1 1 0 0 1 1 1v7h-2v3h2v2h2v-2h2v-3h-2v-7a1 1 0 0 1 1-1h2V8h-4v3Z" />
    </svg>
  ),
  restaurante: (
    <svg viewBox="0 0 24 24" className="category-icon" aria-hidden="true">
      <path d="M3 2a1 1 0 0 1 1 1v2.5h2V3a1 1 0 1 1 2 0v2.5h2V3a1 1 0 1 1 2 0v2.5h2V3a1 1 0 1 1 2 0v2.5h2V3a1 1 0 1 1 2 0v8a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V3a1 1 0 0 1 1-1Zm0 12a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6Z" />
    </svg>
  ),
  cafeteria: (
    <svg viewBox="0 0 24 24" className="category-icon" aria-hidden="true">
      <path d="M3 2a1 1 0 0 1 1 1v1h2V3a1 1 0 1 1 2 0v1h2V3a1 1 0 1 1 2 0v1h2V3a1 1 0 1 1 2 0v1h2V3a1 1 0 1 1 2 0v8a1 1 0 0 1-1 1v7a1 1 0 1 1-2 0v-7H5v7a1 1 0 1 1-2 0v-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  lancheria: (
    <svg viewBox="0 0 24 24" className="category-icon" aria-hidden="true">
      <path d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1.17L17 13.8c.6.94.97 2.05.97 3.2 0 3.31-2.69 6-6 6s-6-2.69-6-6c0-1.15.37-2.26.97-3.2L5.17 8H4a2 2 0 0 1-2-2V4Zm4 8c0 2.21 1.79 4 4 4s4-1.79 4-4H6Z" />
    </svg>
  ),
  balada: (
    <svg viewBox="0 0 24 24" className="category-icon" aria-hidden="true">
      <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-3-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-3 6a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  show: (
    <svg viewBox="0 0 24 24" className="category-icon" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8Zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5Zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11Zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5Z" />
    </svg>
  ),
  praca: (
    <svg viewBox="0 0 24 24" className="category-icon" aria-hidden="true">
      <path d="M12 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm9 7h-6v13h-2v-6h-2v6h-2V9H3V7h4V4c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v3h4V7Z" />
    </svg>
  ),
  evento: (
    <svg viewBox="0 0 24 24" className="category-icon" aria-hidden="true">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 16H5V8h14v11Zm-5.04-6.71l-2.75 3.54 2.08 2.66h5.63L15.96 12l-3.04-3.71-2.96 3.71Z" />
    </svg>
  ),
};

function formatVenueCategory(category) {
  const normalized = String(category || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (VENUE_CATEGORY_LABELS[normalized]) {
    return VENUE_CATEGORY_LABELS[normalized];
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getCategoryIcon(category) {
  const normalized = String(category || '').trim().toLowerCase();
  return CATEGORY_ICONS[normalized] || null;
}

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
  const [openPhotosModal, setOpenPhotosModal] = useState(null);
  const [openAgendaModal, setOpenAgendaModal] = useState(null);
  const [openMenuModal, setOpenMenuModal] = useState(null);
  const [venueDetailsCache, setVenueDetailsCache] = useState({});
  const [venueMenuCache, setVenueMenuCache] = useState({});
  const radarByVenueId = new Map(radar.map((item) => [item.id, item]));

  // Load venue details (photos, agenda and menu) for all venues
  useEffect(() => {
    const loadVenueDetails = async (venueId) => {
      try {
        const response = await api.venueDetails(venueId);
        setVenueDetailsCache((prev) => ({
          ...prev,
          [venueId]: {
            hasPhotos: (response.galleryUrls || []).length > 0,
            hasEvents: (response.agendaEvents || []).length > 0,
          },
        }));
      } catch {
        setVenueDetailsCache((prev) => ({
          ...prev,
          [venueId]: { hasPhotos: false, hasEvents: false },
        }));
      }
    };

    const loadVenueMenu = async (venueId) => {
      try {
        const response = await api.venueMenu(venueId);
        const items = Array.isArray(response) ? response : [];
        setVenueMenuCache((prev) => ({
          ...prev,
          [venueId]: {
            hasMenu: items.length > 0,
            items,
          },
        }));
      } catch {
        setVenueMenuCache((prev) => ({
          ...prev,
          [venueId]: { hasMenu: false, items: [] },
        }));
      }
    };

    setVenueDetailsCache({});
    setVenueMenuCache({});
    venues.forEach((venue) => {
      loadVenueDetails(venue.id);
      loadVenueMenu(venue.id);
    });
  }, [venues]);
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
              <li key={venue.id} className="venue-card-large">
                <div className="venue-card-large__left">
                  <div className="venue-card-large__content">
                    <div className="venue-card-large__logo-section">
                      {venue.establishmentLogoUrl ? (
                        <img
                          src={venue.establishmentLogoUrl}
                          alt={`Logo de ${venue.name}`}
                          className="venue-card-large__logo"
                        />
                      ) : (
                        <span className="venue-card-large__logo-fallback" aria-hidden="true">
                          {String(venue.name || '?').trim().charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="venue-card-large__info">
                      <strong className="venue-card-large__name">{venue.name}</strong>
                      <p className="venue-card-large__address">{venue.address || 'Endereco nao informado'}</p>
                      <div className="venue-card-large__meta">
                        {Number.isFinite(venue.distanceKm) ? (
                          <span className="venue-card-large__distance">{venue.distanceKm} km</span>
                        ) : null}
                        {premiumActive ? (
                          <span className="venue-card-large__people" title="Pessoas no local">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.14 0-7.5 2.52-7.5 5.63A1.12 1.12 0 0 0 5.63 21h12.74a1.12 1.12 0 0 0 1.13-1.12c0-3.11-3.36-5.63-7.5-5.63Z" />
                            </svg>
                            {activePeople}
                          </span>
                        ) : null}
                        {formatVenueCategory(venue.category) ? (
                          <span className="pill venue-card-large__category">
                            {getCategoryIcon(venue.category)}
                            {formatVenueCategory(venue.category)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="venue-card-large__buttons">
                    {venueDetailsCache[venue.id]?.hasEvents && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        title="Ver agenda da semana"
                        aria-label={`Ver agenda de ${venue.name}`}
                        onClick={() => setOpenAgendaModal(venue.id)}
                      >
                        Agenda
                      </button>
                    )}
                    {venueMenuCache[venue.id]?.hasMenu && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        title="Ver cardápio"
                        aria-label={`Ver cardápio de ${venue.name}`}
                        onClick={() => setOpenMenuModal(venue.id)}
                      >
                        Menu
                      </button>
                    )}
                    {venueDetailsCache[venue.id]?.hasPhotos && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        title="Ver fotos"
                        aria-label={`Ver fotos de ${venue.name}`}
                        onClick={() => setOpenPhotosModal(venue.id)}
                      >
                        Fotos
                      </button>
                    )}
                  </div>
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
        loadingVenues={loadingVenues}
        onCheckin={onCheckin}
        onCheckout={onCheckout}
        onLoadPeople={onLoadPeople}
        onSendBilhete={onSendBilhete}
        locationEnabled={locationEnabled}
        locationBlockedMessage={locationBlockedMessage}
        hideVenueList
      />

      {openMenuModal && (
        <Modal
          isOpen={!!openMenuModal}
          onClose={() => setOpenMenuModal(null)}
          title={`Menu - ${venues.find((v) => v.id === openMenuModal)?.name || 'Local'}`}
          className="restaurant-menu-preview-modal"
          hideHeader
        >
          {venueMenuCache[openMenuModal]?.items?.length ? (
            <RestaurantMenuPreview
              title={venues.find((v) => v.id === openMenuModal)?.name || 'Menu do estabelecimento'}
              subtitle="Confira as opções disponíveis neste local."
              items={venueMenuCache[openMenuModal].items}
              emptyMessage="Este estabelecimento ainda não cadastrou itens no menu."
            />
          ) : (
            <p>Nenhum item disponível no momento.</p>
          )}
        </Modal>
      )}

      {openPhotosModal && (
        <VenuePhotosModal
          isOpen={!!openPhotosModal}
          onClose={() => setOpenPhotosModal(null)}
          venueId={openPhotosModal}
          venueName={venues.find((v) => v.id === openPhotosModal)?.name}
        />
      )}

      {openAgendaModal && (
        <VenueAgendaModal
          isOpen={!!openAgendaModal}
          onClose={() => setOpenAgendaModal(null)}
          venueId={openAgendaModal}
          venueName={venues.find((v) => v.id === openAgendaModal)?.name}
        />
      )}
    </div>
  );
}
