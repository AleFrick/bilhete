import { useEffect, useMemo, useRef, useState } from 'react';
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

const INITIAL_PROFILE_FORM = {
  displayName: '',
  city: '',
  address: '',
  category: '',
  description: '',
  logoUrl: '',
  galleryText: '',
  contactEmail: '',
  contactPhone: '',
  instagramUrl: '',
  websiteUrl: '',
};

const INITIAL_LOCATION_CONFIRMATION = {
  lat: '',
  lng: '',
  confirmed: false,
};

const INITIAL_VENUE_SELECTION = {
  searchCity: '',
  searchText: '',
  searchResults: [],
  selectedVenue: null,
  requestNote: '',
  requestDocuments: [],
};

const interactiveMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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

function formatLinkStatus(status) {
  if (status === 'approved') {
    return 'Aprovado';
  }
  if (status === 'pending') {
    return 'Pendente';
  }
  if (status === 'rejected') {
    return 'Rejeitado';
  }
  return 'Sem vínculo';
}

export default function EstablishmentPanelPage() {
  const [profileForm, setProfileForm] = useState(INITIAL_PROFILE_FORM);
  const [locationConfirmation, setLocationConfirmation] = useState(INITIAL_LOCATION_CONFIRMATION);
  const [venueSelection, setVenueSelection] = useState(INITIAL_VENUE_SELECTION);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [mediaTab, setMediaTab] = useState('logo');
  const [gallerySourceMenuOpen, setGallerySourceMenuOpen] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [galleryLoadErrors, setGalleryLoadErrors] = useState({});
  const [previewState, setPreviewState] = useState({
    open: false,
    type: 'logo',
    url: '',
    alt: 'Preview da imagem',
    index: 0,
  });
  const [profileLocationModalOpen, setProfileLocationModalOpen] = useState(false);
  const [profileDraftLocation, setProfileDraftLocation] = useState({ lat: '', lng: '' });
  const [venueRequestModalOpen, setVenueRequestModalOpen] = useState(false);

  const logoFileInputRef = useRef(null);
  const galleryFileInputRef = useRef(null);
  const requestDocsFileInputRef = useRef(null);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [searchingVenues, setSearchingVenues] = useState(false);
  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const [requestingVenueLink, setRequestingVenueLink] = useState(false);
  const [requestingNewVenue, setRequestingNewVenue] = useState(false);

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const [requests, setRequests] = useState([]);

  const profileLocationConfirmed = locationConfirmation.confirmed;
  const profileHasCoordinates = useMemo(() => {
    return Number.isFinite(Number(locationConfirmation.lat)) && Number.isFinite(Number(locationConfirmation.lng));
  }, [locationConfirmation.lat, locationConfirmation.lng]);

  const profileDraftHasCoordinates = useMemo(() => {
    return Number.isFinite(Number(profileDraftLocation.lat)) && Number.isFinite(Number(profileDraftLocation.lng));
  }, [profileDraftLocation.lat, profileDraftLocation.lng]);

  const profileDraftMapCenter = useMemo(
    () =>
      profileDraftHasCoordinates
        ? { lat: Number(profileDraftLocation.lat), lng: Number(profileDraftLocation.lng) }
        : { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng },
    [profileDraftHasCoordinates, profileDraftLocation.lat, profileDraftLocation.lng]
  );

  const hasPendingLinkRequest = useMemo(
    () => requests.some((item) => item.establishmentLinkStatus === 'pending'),
    [requests]
  );
  const hasApprovedLinkRequest = useMemo(
    () => requests.some((item) => item.establishmentLinkStatus === 'approved'),
    [requests]
  );
  const canCreateLinkRequest = !hasPendingLinkRequest && !hasApprovedLinkRequest;

  const galleryUrls = useMemo(
    () =>
      profileForm.galleryText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [profileForm.galleryText]
  );

  const carouselSlides = [...galleryUrls, '__ADD__'];

  const readImageAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    const timer = feedback ? setTimeout(() => setFeedback(''), 3500) : null;
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [feedback]);

  useEffect(() => {
    setLogoLoadError(false);
  }, [profileForm.logoUrl]);

  useEffect(() => {
    if (!previewState.open || previewState.type !== 'gallery') {
      return;
    }

    if (!galleryUrls.length) {
      setPreviewState({
        open: false,
        type: 'logo',
        url: '',
        alt: 'Preview da imagem',
        index: 0,
      });
      return;
    }

    if (previewState.index >= galleryUrls.length) {
      setPreviewState((prev) => ({
        ...prev,
        index: galleryUrls.length - 1,
        alt: `Imagem ${galleryUrls.length} do ambiente`,
      }));
    }
  }, [previewState, galleryUrls]);

  const loadProfile = async () => {
    setLoadingProfile(true);
    setError('');

    try {
      const data = await adminApi.establishmentProfile();
      setProfileForm({
        displayName: data?.displayName || '',
        city: data?.city || '',
        address: data?.address || '',
        category: data?.category || '',
        description: data?.description || '',
        logoUrl: data?.logoUrl || '',
        galleryText: Array.isArray(data?.galleryUrls) ? data.galleryUrls.join('\n') : '',
        contactEmail: data?.contactEmail || '',
        contactPhone: data?.contactPhone || '',
        instagramUrl: data?.instagramUrl || '',
        websiteUrl: data?.websiteUrl || '',
      });
      setLocationConfirmation({
        lat: Number.isFinite(Number(data?.lat)) ? String(data.lat) : '',
        lng: Number.isFinite(Number(data?.lng)) ? String(data.lng) : '',
        confirmed: Boolean(data?.locationConfirmed),
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadRequests = async () => {
    setLoadingRequests(true);
    setError('');

    try {
      const data = await adminApi.establishmentVenueRequests();
      setRequests(data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadRequests();
  }, []);

  const buildProfilePayload = ({ lat, lng, locationConfirmed }) => ({
    displayName: profileForm.displayName,
    city: profileForm.city,
    address: profileForm.address,
    category: profileForm.category,
    lat: lat ?? (locationConfirmation.lat ? Number(locationConfirmation.lat) : undefined),
    lng: lng ?? (locationConfirmation.lng ? Number(locationConfirmation.lng) : undefined),
    locationConfirmed: locationConfirmed ?? profileLocationConfirmed,
    description: profileForm.description,
    logoUrl: profileForm.logoUrl,
    galleryUrls,
    contactEmail: profileForm.contactEmail,
    contactPhone: profileForm.contactPhone,
    instagramUrl: profileForm.instagramUrl,
    websiteUrl: profileForm.websiteUrl,
  });

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError('');

    if (!profileLocationConfirmed) {
      setError('Confirme a localização no mapa antes de salvar o perfil.');
      setSavingProfile(false);
      return;
    }

    try {
      const payload = buildProfilePayload({});

      await adminApi.updateEstablishmentProfile(payload);
      setFeedback('Perfil do estabelecimento salvo com sucesso.');
      await loadProfile();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const openProfileLocationModal = async () => {
    setError('');
    setProfileDraftLocation({
      lat: locationConfirmation.lat || '',
      lng: locationConfirmation.lng || '',
    });
    setProfileLocationModalOpen(true);

    const normalizedAddress = String(profileForm.address || '').trim();
    const normalizedCity = String(profileForm.city || '').trim();
    if (!normalizedAddress || !normalizedCity) {
      return;
    }

    setLoadingGeocode(true);
    try {
      const coords = await adminApi.establishmentGeocode(`${normalizedAddress}, ${normalizedCity}`);
      const lat = Number(coords?.lat);
      const lng = Number(coords?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      setProfileDraftLocation({
        lat: lat.toFixed(7),
        lng: lng.toFixed(7),
      });
    } catch {
      // Keep modal open even if geocoding fails so the user can mark manually on the map.
    } finally {
      setLoadingGeocode(false);
    }
  };

  const closeProfileLocationModal = () => {
    setProfileLocationModalOpen(false);
    setProfileDraftLocation({ lat: '', lng: '' });
  };

  const applyProfileDraftCoordinates = (lat, lng) => {
    setProfileDraftLocation({
      lat: lat.toFixed(7),
      lng: lng.toFixed(7),
    });
  };

  const confirmProfileLocation = async () => {
    if (!profileDraftHasCoordinates) {
      setError('Selecione um ponto no mapa antes de confirmar.');
      return;
    }

    const confirmedLat = Number(profileDraftLocation.lat);
    const confirmedLng = Number(profileDraftLocation.lng);
    if (!Number.isFinite(confirmedLat) || !Number.isFinite(confirmedLng)) {
      setError('Coordenadas inválidas para confirmar localização.');
      return;
    }

    setSavingProfile(true);
    setError('');

    try {
      await adminApi.updateEstablishmentProfile(
        buildProfilePayload({
          lat: confirmedLat,
          lng: confirmedLng,
          locationConfirmed: true,
        })
      );

      await loadProfile();
      setProfileLocationModalOpen(false);
      setProfileDraftLocation({ lat: '', lng: '' });
      setFeedback('Localização confirmada e registrada com sucesso.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const openLogoFilePicker = () => {
    logoFileInputRef.current?.click();
  };

  const openGalleryFilePicker = () => {
    galleryFileInputRef.current?.click();
    setGallerySourceMenuOpen(false);
  };

  const handlePickGalleryFromUrl = () => {
    const value = window.prompt('Cole a URL da nova imagem do ambiente:');
    if (!value) {
      setGallerySourceMenuOpen(false);
      return;
    }

    const normalized = value.trim();
    if (!normalized) {
      setGallerySourceMenuOpen(false);
      return;
    }

    const nextUrls = [...galleryUrls, normalized];
    setProfileForm((prev) => ({ ...prev, galleryText: nextUrls.join('\n') }));
    setGalleryIndex(nextUrls.length - 1);
    setGallerySourceMenuOpen(false);
  };

  const handleLogoFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!String(file.type || '').startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido para o logo.');
      return;
    }

    setError('');
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setProfileForm((prev) => ({ ...prev, logoUrl: dataUrl }));
      setFeedback('Novo logo carregado.');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleGalleryFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!String(file.type || '').startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido para a galeria.');
      return;
    }

    setError('');
    try {
      const dataUrl = await readImageAsDataUrl(file);
      const nextUrls = [...galleryUrls, dataUrl];
      setProfileForm((prev) => ({ ...prev, galleryText: nextUrls.join('\n') }));
      setGalleryIndex(nextUrls.length - 1);
      setFeedback('Nova imagem adicionada ao ambiente.');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleRemoveGalleryImage = (indexToRemove) => {
    if (indexToRemove < 0 || indexToRemove >= galleryUrls.length) {
      return;
    }

    const nextUrls = galleryUrls.filter((_, index) => index !== indexToRemove);
    setProfileForm((prev) => ({ ...prev, galleryText: nextUrls.join('\n') }));
    setGalleryIndex((prev) => {
      if (!nextUrls.length) {
        return 0;
      }
      return Math.max(0, Math.min(prev, nextUrls.length - 1));
    });
  };

  const handleRemoveLogo = () => {
    setProfileForm((prev) => ({ ...prev, logoUrl: '' }));
    setFeedback('Logo removido.');
  };

  const openImagePreview = (url, alt) => {
    if (!url) {
      return;
    }
    setPreviewState({
      open: true,
      type: 'logo',
      url,
      alt: alt || 'Preview da imagem',
      index: 0,
    });
  };

  const openGalleryPreview = (index) => {
    if (!galleryUrls[index]) {
      return;
    }

    setPreviewState({
      open: true,
      type: 'gallery',
      url: '',
      alt: `Imagem ${index + 1} do ambiente`,
      index,
    });
  };

  const closeImagePreview = () => {
    setPreviewState({
      open: false,
      type: 'logo',
      url: '',
      alt: 'Preview da imagem',
      index: 0,
    });
  };

  const goToPreviousPreviewImage = () => {
    if (previewState.type !== 'gallery' || galleryUrls.length < 2) {
      return;
    }

    setPreviewState((prev) => {
      const nextIndex = (prev.index - 1 + galleryUrls.length) % galleryUrls.length;
      return {
        ...prev,
        index: nextIndex,
        alt: `Imagem ${nextIndex + 1} do ambiente`,
      };
    });
  };

  const goToNextPreviewImage = () => {
    if (previewState.type !== 'gallery' || galleryUrls.length < 2) {
      return;
    }

    setPreviewState((prev) => {
      const nextIndex = (prev.index + 1) % galleryUrls.length;
      return {
        ...prev,
        index: nextIndex,
        alt: `Imagem ${nextIndex + 1} do ambiente`,
      };
    });
  };

  const activePreviewUrl =
    previewState.type === 'gallery' ? galleryUrls[previewState.index] || '' : previewState.url;
  const canNavigateGalleryPreview = previewState.type === 'gallery' && galleryUrls.length > 1;

  const handleSelectExistingVenue = (venue) => {
    setVenueSelection((prev) => ({
      ...prev,
      selectedVenue: venue,
    }));
    setFeedback('Local selecionado para solicitação.');
  };

  const resetVenueSelection = () => {
    setVenueSelection(INITIAL_VENUE_SELECTION);
  };

  const openVenueRequestModal = () => {
    setError('');
    setVenueSelection((prev) => ({
      ...INITIAL_VENUE_SELECTION,
      searchCity: profileForm.city || prev.searchCity,
    }));
    setVenueRequestModalOpen(true);
  };

  const closeVenueRequestModal = () => {
    setVenueRequestModalOpen(false);
    resetVenueSelection();
  };

  const startNewVenueRequestFromProfile = () => {
    setVenueSelection((prev) => ({
      ...prev,
      selectedVenue: {
        id: null,
        name: profileForm.displayName || 'Novo local',
        city: profileForm.city || '',
        address: profileForm.address || '',
        category: profileForm.category || '',
      },
    }));
  };

  const handleVenueRequestDocumentsChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) {
      return;
    }

    try {
      const dataUrls = await Promise.all(files.map((file) => readImageAsDataUrl(file)));
      setVenueSelection((prev) => ({
        ...prev,
        requestDocuments: [...prev.requestDocuments, ...dataUrls].slice(0, 10),
      }));
    } catch {
      setError('Não foi possível ler os documentos selecionados.');
    }
  };

  const handleRemoveVenueRequestDocument = (indexToRemove) => {
    setVenueSelection((prev) => ({
      ...prev,
      requestDocuments: prev.requestDocuments.filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleSubmitVenueLink = async (event) => {
    event.preventDefault();
    setError('');

    if (!venueSelection.selectedVenue) {
      setError('Selecione um local existente ou solicite cadastro de novo local.');
      return;
    }

    if (!String(venueSelection.requestNote || '').trim()) {
      setError('Informe um texto para identificar a solicitação.');
      return;
    }

    const isExistingVenue = Boolean(venueSelection.selectedVenue?.id);
    if (isExistingVenue) {
      setRequestingVenueLink(true);
    } else {
      setRequestingNewVenue(true);
    }

    try {
      if (isExistingVenue) {
        await adminApi.requestVenueLink(venueSelection.selectedVenue.id, {
          requestNote: venueSelection.requestNote,
          requestDocuments: venueSelection.requestDocuments,
        });
        setFeedback('Solicitação de vinculação do local enviada para aprovação.');
      } else {
        if (!profileHasCoordinates) {
          throw new Error('Confirme a localização do estabelecimento antes de solicitar cadastro de local.');
        }

        await adminApi.requestNewVenue({
          name: venueSelection.selectedVenue?.name || '',
          city: venueSelection.selectedVenue?.city || '',
          address: venueSelection.selectedVenue?.address || '',
          category: venueSelection.selectedVenue?.category || '',
          lat: Number(locationConfirmation.lat),
          lng: Number(locationConfirmation.lng),
          requestNote: venueSelection.requestNote,
          requestDocuments: venueSelection.requestDocuments,
        });
        setFeedback('Solicitação de novo local enviada para aprovação.');
      }

      closeVenueRequestModal();
      await loadRequests();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRequestingVenueLink(false);
      setRequestingNewVenue(false);
    }
  };

  const handleSearchExistingVenues = async () => {
    setSearchingVenues(true);
    setError('');

    try {
      const data = await adminApi.searchVenuesForLink({ city: venueSelection.searchCity, q: venueSelection.searchText });
      setVenueSelection((prev) => ({
        ...prev,
        searchResults: data || [],
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSearchingVenues(false);
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
        <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Dados do estabelecimento</h2>
          {canCreateLinkRequest ? (
            <button type="button" className="btn btn--ghost" onClick={openVenueRequestModal}>
              Nova solicitação de vinculação
            </button>
          ) : null}
        </div>
        <p className="auth-subtitle">Preencha seu perfil comercial para solicitar vínculo com locais.</p>

        {loadingProfile ? <p>Carregando perfil...</p> : null}

        <form className="admin-form" onSubmit={handleProfileSubmit}>
          <label>
            Nome de exibição
            <input
              value={profileForm.displayName}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))}
              required
            />
          </label>

          <label>
            Cidade
            <input
              value={profileForm.city}
              onChange={(event) => {
                setProfileForm((prev) => ({ ...prev, city: event.target.value }));
                setLocationConfirmation((prev) => ({ ...prev, confirmed: false }));
              }}
              required
            />
          </label>

          <div>
            <p className="auth-subtitle">Categoria principal</p>
            <div className="badge-group admin-category-badges" role="radiogroup" aria-label="Categoria do estabelecimento">
              {CATEGORY_OPTIONS.map((option) => {
                const active = profileForm.category === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`badge-option admin-category-badge ${active ? 'is-active' : ''}`}
                    onClick={() => setProfileForm((prev) => ({ ...prev, category: option.value }))}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="inline-row" style={{ alignItems: 'center', gap: '12px' }}>
              <label>
                Endereço
                <div className="admin-address-search">
                  <input
                    value={profileForm.address}
                    onChange={(event) => {
                      setProfileForm((prev) => ({ ...prev, address: event.target.value }));
                      setLocationConfirmation((prev) => ({ ...prev, confirmed: false }));
                    }}
                  />
                  {!profileLocationConfirmed ? (
                    <button
                      type="button"
                      className="admin-address-search__btn"
                      onClick={openProfileLocationModal}
                      disabled={loadingGeocode}
                      title="Confirmar localização"
                    >
                      {loadingGeocode ? (
                        <span className="spinner admin-address-search__spinner" aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true">🔎</span>
                      )}
                    </button>
                  ) : null}
                </div>
              </label>
              {profileLocationConfirmed ? (
                <span className="pill pill--success" style={{ alignSelf: 'flex-end', marginBottom: '8px' }}>
                  Local Confirmado
                </span>
              ) : null}
              {hasPendingLinkRequest ? (
                <span className="pill pill--warning" style={{ alignSelf: 'flex-end', marginBottom: '8px' }}>
                  Aguardando vinculação
                </span>
              ) : null}
            </div>
          </div>

          <div className="admin-form__compact admin-form__compact--three">
            <label>
              Email de contato
              <input
                type="email"
                value={profileForm.contactEmail}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
              />
            </label>

            <label>
              Telefone de contato
              <input
                value={profileForm.contactPhone}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
              />
            </label>

            <label>
              Website
              <input
                type="url"
                value={profileForm.websiteUrl}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>
          </div>

          <label>
            Instagram oficial
            <input
              type="url"
              value={profileForm.instagramUrl}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, instagramUrl: event.target.value }))}
              placeholder="https://instagram.com/..."
            />
          </label>

          <label>
            Descrição
            <textarea
              rows={4}
              value={profileForm.description}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>

          <section className="panel admin-media-panel">
            <div className="admin-media-tabs" role="tablist" aria-label="Mídias do estabelecimento">
              <button
                type="button"
                role="tab"
                aria-selected={mediaTab === 'logo'}
                className={`admin-media-tab ${mediaTab === 'logo' ? 'is-active' : ''}`}
                onClick={() => setMediaTab('logo')}
              >
                Logo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mediaTab === 'gallery'}
                className={`admin-media-tab ${mediaTab === 'gallery' ? 'is-active' : ''}`}
                onClick={() => setMediaTab('gallery')}
              >
                Imagens do ambiente
              </button>
            </div>

            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoFileChange}
              style={{ display: 'none' }}
            />
            <input
              ref={galleryFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleGalleryFileChange}
              style={{ display: 'none' }}
            />

            {mediaTab === 'logo' ? (
              <div className="admin-image-preview">
                <button
                  type="button"
                  className="admin-logo-picker"
                  onClick={() => openImagePreview(profileForm.logoUrl, 'Logo do estabelecimento')}
                >
                  {profileForm.logoUrl && !logoLoadError ? (
                    <img
                      src={profileForm.logoUrl}
                      alt="Preview do logo do estabelecimento"
                      onError={() => setLogoLoadError(true)}
                    />
                  ) : (
                    <span>{profileForm.logoUrl ? 'Logo indisponivel' : 'Selecionar logo'}</span>
                  )}

                  {profileForm.logoUrl ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className="admin-logo-picker__trash"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRemoveLogo();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          handleRemoveLogo();
                        }
                      }}
                      aria-label="Remover logo atual"
                      title="Remover logo"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
                      </svg>
                    </span>
                  ) : null}

                  <span
                    role="button"
                    tabIndex={0}
                    className="admin-logo-picker__zoom"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openLogoFilePicker();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        openLogoFilePicker();
                      }
                    }}
                    aria-label="Selecionar novo logo"
                    title="Selecionar novo logo"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M10 4a6 6 0 104.24 10.24l4.76 4.76 1.41-1.41-4.76-4.76A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z" />
                    </svg>
                  </span>
                </button>
              </div>
            ) : null}

            {mediaTab === 'gallery' ? (
              <div>
                <div className="admin-carousel admin-carousel--large">
                  {carouselSlides.map((slide, index) => (
                    <button
                      key={slide === '__ADD__' ? `add-${index}` : `${slide}-${index}`}
                      type="button"
                      className={`admin-carousel__slide admin-carousel__slide--large ${index === galleryIndex ? 'is-active' : ''}`}
                      onClick={() => {
                        if (slide === '__ADD__') {
                          setGallerySourceMenuOpen((prev) => !prev);
                          return;
                        }
                        setGallerySourceMenuOpen(false);
                        setGalleryIndex(index);
                        openGalleryPreview(index);
                      }}
                    >
                      {slide === '__ADD__' ? (
                        '+'
                      ) : (
                        <>
                          {!galleryLoadErrors[slide] ? (
                            <img
                              src={slide}
                              alt={`Imagem ${index + 1} do ambiente`}
                              onError={() =>
                                setGalleryLoadErrors((prev) => ({
                                  ...prev,
                                  [slide]: true,
                                }))
                              }
                            />
                          ) : (
                            <span className="admin-carousel__broken">Imagem indisponivel</span>
                          )}
                          <span
                            role="button"
                            tabIndex={0}
                            className="admin-carousel__trash"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleRemoveGalleryImage(index);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                handleRemoveGalleryImage(index);
                              }
                            }}
                            aria-label={`Remover imagem ${index + 1}`}
                            title="Remover imagem"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
                            </svg>
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                </div>

                {gallerySourceMenuOpen ? (
                  <div className="admin-source-menu">
                    <button type="button" className="btn btn--ghost" onClick={openGalleryFilePicker}>
                      Escolher arquivo
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={handlePickGalleryFromUrl}>
                      Colar URL
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="btn btn--primary" disabled={savingProfile || loadingProfile}>
            {savingProfile ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </form>
      </section>

      {profileLocationModalOpen ? (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Confirmar localização do estabelecimento">
          <div className="panel admin-overlay__content admin-image-modal">
            <div className="admin-overlay__header">
              <h2>Confirmar localização do estabelecimento</h2>
            </div>
            <p className="auth-subtitle">Clique no mapa ou arraste o marcador para definir o ponto exato.</p>
            <MapContainer className="admin-map-preview" center={[profileDraftMapCenter.lat, profileDraftMapCenter.lng]} zoom={13} scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickPicker onPick={(lat, lng) => applyProfileDraftCoordinates(lat, lng)} />
              {profileDraftHasCoordinates ? (
                <Marker
                  position={[Number(profileDraftLocation.lat), Number(profileDraftLocation.lng)]}
                  draggable
                  icon={interactiveMarkerIcon}
                  eventHandlers={{
                    dragend(event) {
                      const position = event.target.getLatLng();
                      applyProfileDraftCoordinates(position.lat, position.lng);
                    },
                  }}
                />
              ) : null}
              <MapCenterSync lat={Number(profileDraftLocation.lat)} lng={Number(profileDraftLocation.lng)} />
            </MapContainer>
            <div className="inline-row" style={{ marginTop: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--ghost" onClick={closeProfileLocationModal}>
                Cancelar
              </button>
              <button type="button" className="btn btn--primary" onClick={confirmProfileLocation}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {venueRequestModalOpen ? (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Solicitação de vinculação de local">
          <div className="panel admin-overlay__content admin-image-modal">
            <div className="admin-overlay__header">
              <h2>Solicitação de vinculação</h2>
              <button
                type="button"
                className="btn btn--ghost admin-image-modal__close"
                onClick={closeVenueRequestModal}
                aria-label="Fechar solicitação"
                title="Fechar"
              >
                X
              </button>
            </div>

            <p className="auth-subtitle">Busque um local existente. Se não encontrar, solicite o cadastro de um novo com os dados atuais.</p>

            <div className="admin-search-grid">
              <label>
                Cidade
                <input
                  value={venueSelection.searchCity}
                  onChange={(event) =>
                    setVenueSelection((prev) => ({ ...prev, searchCity: event.target.value }))
                  }
                />
              </label>

              <label>
                Busca
                <input
                  value={venueSelection.searchText}
                  onChange={(event) =>
                    setVenueSelection((prev) => ({ ...prev, searchText: event.target.value }))
                  }
                  placeholder="Nome, endereço ou categoria"
                />
              </label>

              <button type="button" className="btn btn--primary" onClick={handleSearchExistingVenues} disabled={searchingVenues}>
                {searchingVenues ? 'Buscando...' : 'Localizar local'}
              </button>
            </div>

            {!searchingVenues && venueSelection.searchResults.length ? (
              <ul className="simple-list" style={{ marginTop: '12px' }}>
                {venueSelection.searchResults.map((venue) => (
                  <li key={venue.id}>
                    <div>
                      <strong>{venue.name}</strong>
                      <p>{venue.city || 'Cidade não informada'}</p>
                      <p>{venue.address || 'Endereço não informado'}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => handleSelectExistingVenue(venue)}
                    >
                      Selecionar
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {!venueSelection.selectedVenue ? (
              <div className="inline-row" style={{ marginTop: '12px', justifyContent: 'space-between' }}>
                <p className="auth-subtitle">Não encontrou o local?</p>
                <button type="button" className="btn btn--ghost" onClick={startNewVenueRequestFromProfile}>
                  Solicitar cadastro de local
                </button>
              </div>
            ) : null}

            {venueSelection.selectedVenue ? (
              <form className="admin-form" onSubmit={handleSubmitVenueLink} style={{ marginTop: '12px' }}>
                <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>
                    {venueSelection.selectedVenue.id ? 'Local selecionado para vinculação' : 'Solicitação de novo local'}
                  </strong>
                  <button type="button" className="btn btn--ghost" onClick={resetVenueSelection}>
                    Limpar
                  </button>
                </div>

                <p>{venueSelection.selectedVenue.name || profileForm.displayName}</p>
                <p className="auth-subtitle">
                  {venueSelection.selectedVenue.address || profileForm.address || 'Endereço não informado'}
                </p>

                <label>
                  Texto de identificação da solicitação
                  <textarea
                    rows={4}
                    value={venueSelection.requestNote}
                    onChange={(event) =>
                      setVenueSelection((prev) => ({ ...prev, requestNote: event.target.value }))
                    }
                    placeholder="Descreva como identificar o estabelecimento e o motivo da solicitação"
                    required
                  />
                </label>

                <div>
                  <p className="auth-subtitle">Documentos complementares</p>
                  <input
                    ref={requestDocsFileInputRef}
                    type="file"
                    multiple
                    onChange={handleVenueRequestDocumentsChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => requestDocsFileInputRef.current?.click()}
                  >
                    Anexar documentos
                  </button>

                  {venueSelection.requestDocuments.length ? (
                    <ul className="simple-list" style={{ marginTop: '10px' }}>
                      {venueSelection.requestDocuments.map((_, index) => (
                        <li key={`doc-${index}`}>
                          <div>
                            <strong>Documento {index + 1}</strong>
                          </div>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => handleRemoveVenueRequestDocument(index)}
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="inline-row" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" className="btn btn--ghost" onClick={closeVenueRequestModal}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={requestingVenueLink || requestingNewVenue}
                  >
                    {requestingVenueLink || requestingNewVenue
                      ? 'Enviando...'
                      : venueSelection.selectedVenue.id
                        ? 'Solicitar vínculo'
                        : 'Solicitar cadastro de local'}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {previewState.open && activePreviewUrl ? (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Preview da imagem">
          <div className="panel admin-overlay__content admin-image-modal">
            <div className="admin-overlay__header">
              <h2>Preview da imagem</h2>
              <button
                type="button"
                className="btn btn--ghost admin-image-modal__close"
                onClick={closeImagePreview}
                aria-label="Fechar preview"
                title="Fechar"
              >
                X
              </button>
            </div>
            <div className="admin-image-modal__body">
              {canNavigateGalleryPreview ? (
                <button
                  type="button"
                  className="admin-image-modal__nav admin-image-modal__nav--prev"
                  onClick={goToPreviousPreviewImage}
                  aria-label="Imagem anterior"
                  title="Imagem anterior"
                >
                  <span aria-hidden="true">&#8249;</span>
                </button>
              ) : null}

              <img src={activePreviewUrl} alt={previewState.alt} />

              {canNavigateGalleryPreview ? (
                <button
                  type="button"
                  className="admin-image-modal__nav admin-image-modal__nav--next"
                  onClick={goToNextPreviewImage}
                  aria-label="Próxima imagem"
                  title="Próxima imagem"
                >
                  <span aria-hidden="true">&#8250;</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
