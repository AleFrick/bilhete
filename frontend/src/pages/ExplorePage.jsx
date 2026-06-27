import { useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import Modal from '../components/Modal';
import RestaurantMenuPreview from '../components/RestaurantMenuPreview';

const BILHETE_PRESETS = [
  { id: 'troquei_olhares', type: 'troquei_olhares', text: '👀 Te vi por aqui' },
  { id: 'emoji_brinde', type: 'emoji', text: '🥂 Bora brindar' },
  { id: 'curtida_vibe', type: 'curtida', text: '😍 Curti tua vibe' },
  { id: 'mensagem_conversar', type: 'mensagem_livre', text: '🤝 Vamos conversar' },
];

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

function getProfilePhoto(person) {
  if (Array.isArray(person?.photoUrls) && person.photoUrls.length) {
    return person.photoUrls[0];
  }

  return 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80';
}

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

export default function ExplorePage({
  venues,
  currentCheckin,
  people,
  loadingPeople,
  loadingVenues = false,
  onCheckin,
  onCheckout,
  onLoadPeople,
  onSendBilhete,
  hideVenueList = false,
  locationEnabled = true,
  locationBlockedMessage = '',
}) {
  const [activeScreen, setActiveScreen] = useState('venues');
  const [peopleFilter, setPeopleFilter] = useState('');
  const [peopleNotice, setPeopleNotice] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [displayedPeople, setDisplayedPeople] = useState([]);
  const [menuStateByVenueId, setMenuStateByVenueId] = useState({});
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [activeMenuVenue, setActiveMenuVenue] = useState(null);
  const [activeMenuItems, setActiveMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  const selectedPerson = useMemo(
    () => displayedPeople.find((person) => person.id === selectedPersonId) || null,
    [displayedPeople, selectedPersonId]
  );

  const selectedPreset = useMemo(
    () => BILHETE_PRESETS.find((preset) => preset.id === selectedPresetId) || null,
    [selectedPresetId]
  );

  const filteredPeople = useMemo(() => {
    const normalizedFilter = peopleFilter.trim().toLowerCase();
    if (!normalizedFilter) {
      return displayedPeople;
    }

    return displayedPeople.filter((person) => person.name.toLowerCase().includes(normalizedFilter));
  }, [displayedPeople, peopleFilter]);

  useEffect(() => {
    if (currentCheckin?.venueId) {
      setDisplayedPeople([]);
      onLoadPeople(currentCheckin.venueId);
      setActiveScreen('people');
      return;
    }

    setActiveScreen('venues');
    setPeopleFilter('');
    setSelectedPersonId(null);
    setSelectedPresetId(null);
    setCustomMessage('');
    setPeopleNotice('');
    setDisplayedPeople([]);
  }, [currentCheckin?.venueId]);

  useEffect(() => {
    if (activeScreen !== 'profile') {
      return;
    }

    if (!selectedPersonId || !displayedPeople.some((person) => person.id === selectedPersonId)) {
      setActiveScreen('people');
    }
  }, [activeScreen, displayedPeople, selectedPersonId]);

  useEffect(() => {
    if (!loadingPeople) {
      setDisplayedPeople(people);
    }
  }, [loadingPeople, people]);

  useEffect(() => {
    if (!Array.isArray(venues) || !venues.length) {
      return;
    }

    const loadVenueMenuAvailability = async () => {
      for (const venue of venues) {
        if (menuStateByVenueId[venue.id]) {
          continue;
        }

        setMenuStateByVenueId((previous) => {
          if (previous[venue.id]) {
            return previous;
          }

          return {
            ...previous,
            [venue.id]: { loading: true, hasItems: false, items: [] },
          };
        });

        try {
          const items = await api.venueMenu(venue.id);
          setMenuStateByVenueId((previous) => ({
            ...previous,
            [venue.id]: {
              loading: false,
              hasItems: Array.isArray(items) && items.length > 0,
              items: Array.isArray(items) ? items : [],
            },
          }));
        } catch {
          setMenuStateByVenueId((previous) => ({
            ...previous,
            [venue.id]: { loading: false, hasItems: false, items: [] },
          }));
        }
      }
    };

    loadVenueMenuAvailability();
  }, [venues]);

  const handleSendBilhete = async () => {
    if (!currentCheckin || !selectedPerson) {
      return;
    }

    const finalMessage = customMessage.trim() || selectedPreset?.text || '';

    await onSendBilhete({
      toUserId: selectedPerson.id,
      venueId: currentCheckin.venueId,
      type: selectedPreset?.type || 'mensagem_livre',
      message: finalMessage || undefined,
    });

    setCustomMessage('');
    setSelectedPresetId(null);
    setActiveScreen('people');
    setPeopleNotice('Bilhete enviado! Se rolar conexao, o chat de voces abre na hora.');
  };

  const handleCheckin = async (venueId) => {
    setPeopleNotice('');
    setActiveScreen('people');
    await onCheckin(venueId);
  };

  const handleOpenPerson = (personId) => {
    setSelectedPersonId(personId);
    setActiveScreen('profile');
  };

  const handleRefreshPeople = async () => {
    if (!currentCheckin?.venueId) {
      return;
    }

    setPeopleNotice('');
    setDisplayedPeople([]);
    await onLoadPeople(currentCheckin.venueId);
  };

  const handleOpenMenu = async (venue) => {
    const cachedMenu = menuStateByVenueId[venue.id];

    if (cachedMenu?.hasItems && cachedMenu.items?.length) {
      setActiveMenuVenue(venue);
      setActiveMenuItems(cachedMenu.items);
      setShowMenuModal(true);
      return;
    }

    setLoadingMenu(true);
    setActiveMenuVenue(venue);

    try {
      const items = await api.venueMenu(venue.id);
      const normalizedItems = Array.isArray(items) ? items : [];

      setMenuStateByVenueId((previous) => ({
        ...previous,
        [venue.id]: {
          loading: false,
          hasItems: normalizedItems.length > 0,
          items: normalizedItems,
        },
      }));

      if (normalizedItems.length) {
        setActiveMenuItems(normalizedItems);
        setShowMenuModal(true);
      } else {
        setActiveMenuItems([]);
        setShowMenuModal(false);
      }
    } catch {
      setActiveMenuItems([]);
      setShowMenuModal(false);
    } finally {
      setLoadingMenu(false);
    }
  };

  const handleBack = () => {
    if (activeScreen === 'profile') {
      setActiveScreen('people');
      return;
    }

    if (currentCheckin?.venueId) {
      setActiveScreen('people');
      return;
    }

    setActiveScreen('venues');
  };

  return (
    <div className="page-stack explore-mobile">
      {!hideVenueList && !currentCheckin ? (
        <section className="panel">
          <h3>Locais para check-in</h3>
          {!locationEnabled ? (
            <p className="explore-notice">
              {locationBlockedMessage ||
                'Sem localizacao ativa, o Bilhete perde a magia dos encontros por perto. Ative a permissao para liberar uma experiencia completa.'}
            </p>
          ) : loadingVenues ? (
            <div className="explore-loader" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <p>Carregando locais...</p>
            </div>
          ) : (
            <ul className="simple-list">
              {venues.map((venue) => (
                <li key={venue.id}>
                  <div className="explore-venue-item">
                    <div className="explore-venue-item__head">
                      {venue.establishmentLogoUrl ? (
                        <img
                          src={venue.establishmentLogoUrl}
                          alt={`Logo de ${venue.name}`}
                          className="explore-venue-item__logo"
                        />
                      ) : (
                        <span className="explore-venue-item__logo-fallback" aria-hidden="true">
                          {String(venue.name || '?').trim().charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                      <strong>{venue.name}</strong>
                    </div>
                    {formatVenueCategory(venue.category) ? (
                      <span className="pill explore-venue-item__badge">{formatVenueCategory(venue.category)}</span>
                    ) : null}
                    <p>{venue.address || 'Endereco nao informado'}</p>
                    {Number.isFinite(venue.distanceKm) ? <p>{venue.distanceKm} km de voce</p> : null}
                  </div>
                  <div className="inline-row" style={{ gap: '8px' }}>
                    {menuStateByVenueId[venue.id]?.hasItems ? (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => handleOpenMenu(venue)}
                        disabled={loadingMenu}
                        aria-label={`Abrir cardápio de ${venue.name}`}
                        title={`Cardápio de ${venue.name}`}
                      >
                        ☰
                      </button>
                    ) : null}
                    <button type="button" className="btn btn--primary" onClick={() => handleCheckin(venue.id)}>
                      Check-in
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <Modal
        isOpen={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        title={activeMenuVenue ? `Cardápio de ${activeMenuVenue.name}` : 'Cardápio'}
        className="restaurant-menu-preview-modal"
        hideHeader
      >
        {activeMenuItems.length ? (
          <RestaurantMenuPreview
            title={activeMenuVenue?.name || 'Menu do estabelecimento'}
            subtitle="Confira as opções disponíveis neste local."
            items={activeMenuItems}
            emptyMessage="Este estabelecimento ainda não cadastrou itens no menu."
          />
        ) : (
          <p>Nenhum item disponível no momento.</p>
        )}
      </Modal>

      {currentCheckin && activeScreen !== 'venues' ? (
        <section className="panel explore-overlay" role="dialog" aria-modal="false">
          <header className="explore-overlay__header">
            {activeScreen === 'profile' ? (
              <button type="button" className="btn btn--ghost btn--arrow" onClick={handleBack}>
                ←
              </button>
            ) : null}
            <h3>{activeScreen === 'people' ? 'Pessoas no local' : 'Perfil'}</h3>
          </header>

          {activeScreen === 'people' ? (
            <>
              <div className="inline-row">
                <p>
                  Em <strong>{currentCheckin.venueName}</strong>
                </p>
                <button
                  type="button"
                  className="btn btn--ghost btn--arrow"
                  onClick={handleRefreshPeople}
                  disabled={loadingPeople}
                  aria-label="Atualizar lista"
                  title="Atualizar lista"
                >
                  ↻
                </button>
                <button type="button" className="btn btn--ghost" onClick={onCheckout}>
                  Sair
                </button>
              </div>

              <label className="explore-filter">
                <input
                  placeholder="Buscar por nome..."
                  value={peopleFilter}
                  onChange={(event) => setPeopleFilter(event.target.value)}
                />
              </label>

              {peopleNotice ? <p className="explore-notice">{peopleNotice}</p> : null}

              {loadingPeople ? (
                <div className="explore-loader" role="status" aria-live="polite">
                  <span className="spinner" aria-hidden="true" />
                  <p>Carregando pessoas...</p>
                </div>
              ) : null}
              {!loadingPeople && !filteredPeople.length ? <p>Nenhuma pessoa encontrada neste local.</p> : null}

              {!loadingPeople && filteredPeople.length > 0 ? (
                <ul className="simple-list people-list-mobile">
                  {filteredPeople.map((person) => (
                  <li key={person.id}>
                    <div className="person-row-main">
                      <img src={getProfilePhoto(person)} alt={`Foto de ${person.name}`} className="person-avatar" />
                      <div>
                        <strong>{person.name}</strong>
                        <p>{person.statusSocial}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--arrow"
                      onClick={() => handleOpenPerson(person.id)}
                      aria-label={`Abrir perfil de ${person.name}`}
                    >
                      →
                    </button>
                  </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : selectedPerson ? (
            <section className="panel panel--person-detail">
              <div className="profile-carousel" aria-label="Fotos do perfil selecionado">
                {(selectedPerson.photoUrls?.length ? selectedPerson.photoUrls : [getProfilePhoto(selectedPerson)]).map(
                  (photo, index) => (
                    <article className="profile-photo-card" key={`${selectedPerson.id}-${index}`}>
                      <img src={photo} alt={`Foto ${index + 1} de ${selectedPerson.name}`} />
                    </article>
                  )
                )}
              </div>

              <p className="person-headline">
                {selectedPerson.name}
                {selectedPerson.age ? `, ${selectedPerson.age}` : ''}
              </p>

              <p className="person-bilhete-label">Escolha um bilhete ou escreva o seu</p>

              <div className="preset-list">
                {BILHETE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset-item ${selectedPresetId === preset.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedPresetId(preset.id);
                      setCustomMessage('');
                    }}
                  >
                    {preset.text}
                  </button>
                ))}
              </div>

              <label>
                Seu bilhete
                <input
                  placeholder="Escreva aqui..."
                  value={customMessage}
                  onChange={(event) => {
                    setSelectedPresetId(null);
                    setCustomMessage(event.target.value);
                  }}
                />
              </label>

              <button type="button" className="btn btn--primary btn--full" onClick={handleSendBilhete}>
                Enviar bilhete
              </button>
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
