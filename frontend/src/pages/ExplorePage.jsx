import { useEffect, useMemo, useState } from 'react';

const BILHETE_PRESETS = [
  { id: 'troquei_olhares', type: 'troquei_olhares', text: '👀 Te vi por aqui' },
  { id: 'emoji_brinde', type: 'emoji', text: '🥂 Bora brindar' },
  { id: 'curtida_vibe', type: 'curtida', text: '😍 Curti tua vibe' },
  { id: 'mensagem_conversar', type: 'mensagem_livre', text: '🤝 Vamos conversar' },
];

function getProfilePhoto(person) {
  if (Array.isArray(person?.photoUrls) && person.photoUrls.length) {
    return person.photoUrls[0];
  }

  return 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80';
}

export default function ExplorePage({
  venues,
  currentCheckin,
  people,
  loadingPeople,
  onCheckin,
  onCheckout,
  onLoadPeople,
  onSendBilhete,
}) {
  const [activeScreen, setActiveScreen] = useState('venues');
  const [peopleFilter, setPeopleFilter] = useState('');
  const [peopleNotice, setPeopleNotice] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [customMessage, setCustomMessage] = useState('');

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) || null,
    [people, selectedPersonId]
  );

  const selectedPreset = useMemo(
    () => BILHETE_PRESETS.find((preset) => preset.id === selectedPresetId) || null,
    [selectedPresetId]
  );

  const filteredPeople = useMemo(() => {
    const normalizedFilter = peopleFilter.trim().toLowerCase();
    if (!normalizedFilter) {
      return people;
    }

    return people.filter((person) => person.name.toLowerCase().includes(normalizedFilter));
  }, [people, peopleFilter]);

  useEffect(() => {
    if (currentCheckin?.venueId) {
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
  }, [currentCheckin?.venueId]);

  useEffect(() => {
    if (activeScreen !== 'profile') {
      return;
    }

    if (!selectedPersonId || !people.some((person) => person.id === selectedPersonId)) {
      setActiveScreen('people');
    }
  }, [activeScreen, people, selectedPersonId]);

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
    await onLoadPeople(currentCheckin.venueId);
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
      {!currentCheckin ? (
        <section className="panel">
          <h3>Locais para check-in</h3>
          <ul className="simple-list">
            {venues.map((venue) => (
              <li key={venue.id}>
                <div>
                  <strong>{venue.name}</strong>
                  <p>{venue.address || 'Endereco nao informado'}</p>
                </div>
                <button type="button" className="btn btn--primary" onClick={() => handleCheckin(venue.id)}>
                  Check-in
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
