import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { adminApi } from '../api/adminClient';

import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DEFAULT_CENTER = {
  lat: -29.6882,
  lng: -53.8069,
};

const CATEGORY_OPTIONS = [
  { value: 'bar', label: 'Bar' },
  { value: 'pub', label: 'Pub' },
  { value: 'balada', label: 'Balada' },
  { value: 'show', label: 'Show' },
  { value: 'cafeteria', label: 'Cafeteria' },
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'praca', label: 'Praca' },
  { value: 'evento', label: 'Evento' },
];

const interactiveMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const INITIAL_FORM = {
  name: '',
  city: '',
  address: '',
  category: '',
  partnerStatus: false,
  lat: '',
  lng: '',
};

function MapCenterSync({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    map.setView([lat, lng], 16, { animate: true });
  }, [lat, lng, map]);

  return null;
}

function MapClickPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

async function geocodeAddress(address) {
  const value = String(address || '').trim();
  if (!value) {
    return null;
  }

  const coords = await adminApi.geocodeAddress(value);
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  throw new Error('Nao encontrei esse endereco no Brasil. Tente incluir numero e cidade/UF.');
}

export default function AdminVenuesPage({
  cities,
  loadingCities,
  venues,
  loadingVenues,
  onSearchVenues,
  onCreateVenue,
  onUpdateVenue,
  onUpdateVenueLinkApproval,
  loadingCreate,
  error,
}) {
  const [feedback, setFeedback] = useState('');
  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [filterCity, setFilterCity] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [editorMode, setEditorMode] = useState(null);
  const [editingVenueId, setEditingVenueId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timer = setTimeout(() => setFeedback(''), 3600);
    return () => clearTimeout(timer);
  }, [feedback]);

  const latitude = Number(form.lat);
  const longitude = Number(form.lng);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  const mapCenter = useMemo(
    () =>
      hasCoordinates
        ? { lat: latitude, lng: longitude }
        : { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng },
    [hasCoordinates, latitude, longitude]
  );

  const runSearch = async () => {
    if (!filterCity) {
      setFeedback('Selecione uma cidade para buscar os locais.');
      return;
    }

    setHasSearched(true);
    await onSearchVenues({ city: filterCity, q: filterText.trim(), category: filterCategory });
  };

  const applyCoordinates = (lat, lng, source) => {
    setForm((prev) => ({
      ...prev,
      lat: lat.toFixed(7),
      lng: lng.toFixed(7),
    }));

    if (source === 'map') {
      setFeedback('Posicao ajustada no mapa.');
      return;
    }

    setFeedback('Endereco localizado. Ajuste o marcador para maior precisao.');
  };

  const handleResolveAddress = async () => {
    const normalizedAddress = form.address.trim();
    if (!normalizedAddress) {
      setFeedback('Informe um endereco para localizar no mapa.');
      return;
    }

    setLoadingGeocode(true);
    setFeedback('');

    try {
      const coords = await geocodeAddress(`${normalizedAddress}, ${form.city || ''}`.trim());
      if (!coords) {
        setFeedback('Nao encontrei esse endereco. Tente mais detalhes, como numero e cidade.');
        return;
      }

      applyCoordinates(coords.lat, coords.lng, 'address');
    } catch (requestError) {
      setFeedback(requestError.message || 'Falha ao localizar o endereco no mapa.');
    } finally {
      setLoadingGeocode(false);
    }
  };

  const openCreateOverlay = () => {
    setEditorMode('create');
    setEditingVenueId(null);
    setForm({ ...INITIAL_FORM, city: filterCity || '' });
    setFeedback('');
  };

  const openEditOverlay = (venue) => {
    setEditorMode('edit');
    setEditingVenueId(venue.id);
    setForm({
      name: venue.name || '',
      city: venue.city || '',
      address: venue.address || '',
      category: venue.category || '',
      partnerStatus: Boolean(venue.partnerStatus),
      lat: Number.isFinite(Number(venue.lat)) ? Number(venue.lat).toFixed(7) : '',
      lng: Number.isFinite(Number(venue.lng)) ? Number(venue.lng).toFixed(7) : '',
    });
    setFeedback('Modo edicao ativado.');
  };

  const closeOverlay = () => {
    setEditorMode(null);
    setEditingVenueId(null);
    setForm(INITIAL_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback('');

    const payload = {
      name: form.name,
      city: form.city,
      address: form.address,
      category: form.category,
      partnerStatus: form.partnerStatus,
      lat: latitude,
      lng: longitude,
    };

    try {
      if (editorMode === 'edit' && editingVenueId) {
        await onUpdateVenue(editingVenueId, payload);
        setFeedback('Local atualizado com sucesso.');
      } else {
        await onCreateVenue(payload);
        setFeedback('Local cadastrado com sucesso.');
      }

      closeOverlay();
      if (filterCity) {
        setHasSearched(true);
        await onSearchVenues({ city: filterCity, q: filterText.trim(), category: filterCategory });
      }
    } catch (requestError) {
      // Error state handled by parent.
    }
  };

  const handleLinkApproval = async (venueId, status) => {
    try {
      await onUpdateVenueLinkApproval(venueId, status);
      setFeedback(
        status === 'approved' ? 'Vinculo aprovado com sucesso.' : 'Solicitacao de vinculo rejeitada.'
      );
    } catch (requestError) {
      // Error state handled by parent.
    }
  };

  return (
    <div className="admin-page-stack">
      {feedback ? (
        <div className="admin-toast" role="status" aria-live="polite">
          {feedback}
        </div>
      ) : null}

      <section className="panel">
        <div className="inline-row" style={{ justifyContent: 'space-between' }}>
          <h2>Locais cadastrados</h2>
          <button type="button" className="btn btn--primary" onClick={openCreateOverlay}>
            Novo local
          </button>
        </div>

        <div className="admin-search-grid">
          <label>
            Cidade
            <select value={filterCity} onChange={(event) => setFilterCity(event.target.value)} disabled={loadingCities}>
              <option value="">Selecione</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label>
            Filtro unico
            <input
              placeholder="Nome, endereco, categoria ou qualquer dado"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
            />
          </label>

          <button type="button" className="btn btn--primary" onClick={runSearch} disabled={loadingVenues || !filterCity}>
            Buscar
          </button>
        </div>

        <div>
          <div className="badge-group admin-category-badges" role="radiogroup" aria-label="Filtro de categoria">
            <button
              type="button"
              role="radio"
              aria-checked={!filterCategory}
              className={`badge-option admin-category-badge ${!filterCategory ? 'is-active' : ''}`}
              onClick={() => setFilterCategory('')}
            >
              Todas
            </button>
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={filterCategory === option.value}
                className={`badge-option admin-category-badge ${filterCategory === option.value ? 'is-active' : ''}`}
                onClick={() => setFilterCategory(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {!hasSearched ? <p>Selecione uma cidade e clique em buscar para listar os locais.</p> : null}
        {hasSearched && loadingVenues ? (
          <div className="admin-grid-loader" role="status" aria-live="polite" aria-label="Carregando locais">
            <span className="spinner" aria-hidden="true" />
          </div>
        ) : null}
        {hasSearched && !loadingVenues && !venues.length ? <p>Nenhum local encontrado para este filtro.</p> : null}

        {hasSearched && !loadingVenues ? (
          <ul className="simple-list">
            {venues.map((venue) => (
              <li key={venue.id}>
                <div>
                  <strong>{venue.name}</strong>
                  <p>{venue.city || 'Cidade nao informada'}</p>
                  <p>{venue.address || 'Endereco nao informado'}</p>
                  {venue.establishmentName ? <p>Estabelecimento: {venue.establishmentName}</p> : null}
                </div>
                <div className="inline-row">
                  <span className="pill">{venue.category || 'sem categoria'}</span>
                  {venue.establishmentLinkStatus === 'pending' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => handleLinkApproval(venue.id, 'approved')}
                        disabled={loadingCreate}
                      >
                        Aprovar vinculo
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => handleLinkApproval(venue.id, 'rejected')}
                        disabled={loadingCreate}
                      >
                        Rejeitar
                      </button>
                    </>
                  ) : null}
                  {venue.establishmentLinkStatus && venue.establishmentLinkStatus !== 'none' ? (
                    <span className="pill">{venue.establishmentLinkStatus}</span>
                  ) : null}
                  <button type="button" className="btn btn--ghost" onClick={() => openEditOverlay(venue)}>
                    Editar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {editorMode ? (
        <section className="admin-overlay" role="dialog" aria-modal="true">
          <div className="panel admin-overlay__content">
            <header className="admin-overlay__header">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeOverlay}
                aria-label="Voltar para a lista"
                title="Voltar para a lista"
              >
                ←
              </button>
              <h2>{editorMode === 'edit' ? 'Editar estabelecimento' : 'Novo estabelecimento'}</h2>
            </header>

            <form className="admin-form" onSubmit={handleSubmit}>
              <label>
                Nome do local
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>

              <label>
                Cidade
                <input
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                  required
                />
              </label>

              <label>
                Endereco
                <div className="admin-address-search">
                  <input
                    placeholder="Rua, numero, bairro"
                    value={form.address}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, address: event.target.value, lat: '', lng: '' }))
                    }
                  />
                  <button
                    type="button"
                    className="admin-address-search__btn"
                    onClick={handleResolveAddress}
                    disabled={loadingGeocode}
                  >
                    {loadingGeocode ? (
                      <span className="spinner admin-address-search__spinner" aria-hidden="true" />
                    ) : (
                      <svg className="admin-search-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10 4a6 6 0 104.24 10.24l4.76 4.76 1.41-1.41-4.76-4.76A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              <div>
                <p className="auth-subtitle">Categoria (selecione uma)</p>
                <div className="badge-group admin-category-badges" role="radiogroup" aria-label="Categoria do local">
                  {CATEGORY_OPTIONS.map((option) => {
                    const active = form.category === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`badge-option admin-category-badge ${active ? 'is-active' : ''}`}
                        onClick={() => setForm((prev) => ({ ...prev, category: option.value }))}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!hasCoordinates ? <p className="auth-subtitle">Defina o ponto no mapa para habilitar o salvamento.</p> : null}

              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.partnerStatus}
                  onChange={(event) => setForm((prev) => ({ ...prev, partnerStatus: event.target.checked }))}
                />
                Local parceiro
              </label>

              <button type="submit" className="btn btn--primary" disabled={loadingCreate || !hasCoordinates}>
                {loadingCreate ? 'Salvando...' : editorMode === 'edit' ? 'Salvar alteracoes' : 'Cadastrar local'}
              </button>
            </form>

            <section className="panel">
              <h3>Mapa interativo</h3>
              <MapContainer className="admin-map-preview" center={[mapCenter.lat, mapCenter.lng]} zoom={13} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickPicker onPick={(lat, lng) => applyCoordinates(lat, lng, 'map')} />
                {hasCoordinates ? (
                  <Marker
                    position={[latitude, longitude]}
                    draggable
                    icon={interactiveMarkerIcon}
                    eventHandlers={{
                      dragend(event) {
                        const position = event.target.getLatLng();
                        applyCoordinates(position.lat, position.lng, 'map');
                      },
                    }}
                  />
                ) : null}
                <MapCenterSync lat={latitude} lng={longitude} />
              </MapContainer>
            </section>
          </div>
        </section>
      ) : null}
    </div>
  );
}
