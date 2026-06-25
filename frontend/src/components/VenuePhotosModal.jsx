import { useEffect, useState } from 'react';
import Modal from './Modal';
import { api } from '../api/client';

export default function VenuePhotosModal({ isOpen, onClose, venueId, venueName }) {
  const [photos, setPhotos] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !venueId) return;

    setLoading(true);
    setError(null);

    api
      .venueDetails(venueId)
      .then((response) => {
        const galleryUrls = response.galleryUrls || [];
        setPhotos(galleryUrls);
        setActiveIndex(0);
      })
      .catch((err) => {
        console.error('Erro ao carregar fotos:', err);
        setError('Erro ao carregar fotos');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, venueId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Fotos - ${venueName || 'Local'}`}>
      {loading ? (
        <p className="modal__loading">Carregando fotos...</p>
      ) : error ? (
        <p className="modal__error">{error}</p>
      ) : photos.length === 0 ? (
        <p className="modal__empty">Nenhuma foto cadastrada</p>
      ) : (
        <div className="photos-viewer">
          <div className="photos-viewer__main">
            <button
              type="button"
              className="photos-viewer__nav photos-viewer__nav--prev"
              onClick={() => setActiveIndex((prev) => (prev - 1 + photos.length) % photos.length)}
              aria-label="Foto anterior"
              title="Foto anterior"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.71 6.71a1 1 0 0 1 0 1.41L10.83 12l3.88 3.88a1 1 0 0 1-1.41 1.41l-4.59-4.58a1 1 0 0 1 0-1.42l4.59-4.58a1 1 0 0 1 1.41 0Z" />
              </svg>
            </button>

            <img
              src={photos[activeIndex]}
              alt={`Foto ${activeIndex + 1} de ${photos.length}`}
              className="photos-viewer__main-image"
            />

            <button
              type="button"
              className="photos-viewer__nav photos-viewer__nav--next"
              onClick={() => setActiveIndex((prev) => (prev + 1) % photos.length)}
              aria-label="Próxima foto"
              title="Próxima foto"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.29 17.29a1 1 0 0 1 0-1.41L13.17 12 9.29 8.12a1 1 0 0 1 1.41-1.41l4.59 4.58a1 1 0 0 1 0 1.42l-4.59 4.58a1 1 0 0 1-1.41 0Z" />
              </svg>
            </button>
          </div>

          <div className="photos-viewer__thumbs" role="tablist" aria-label="Miniaturas das fotos">
            {photos.map((photoUrl, index) => (
              <button
                key={`${photoUrl}-${index}`}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                className={`photos-viewer__thumb ${index === activeIndex ? 'is-active' : ''}`}
                onClick={() => setActiveIndex(index)}
                title={`Ir para foto ${index + 1}`}
              >
                <img src={photoUrl} alt={`Miniatura ${index + 1}`} className="photos-viewer__thumb-image" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
