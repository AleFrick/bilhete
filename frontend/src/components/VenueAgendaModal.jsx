import { useEffect, useState } from 'react';
import Modal from './Modal';
import { api } from '../api/client';

export default function VenueAgendaModal({ isOpen, onClose, venueId, venueName }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    if (!isOpen || !venueId) return;

    setLoading(true);
    setError(null);

    api
      .venueDetails(venueId)
      .then((response) => {
        const agendaEvents = response.agendaEvents || [];
        setEvents(agendaEvents);
      })
      .catch((err) => {
        console.error('Erro ao carregar agenda:', err);
        setError('Erro ao carregar agenda');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, venueId]);

  if (selectedEvent) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent.title}
      >
        <div className="event-details">
          <div className="event-details__info">
            <p>
              <strong>Data:</strong>{' '}
              {new Date(selectedEvent.eventDate).toLocaleDateString('pt-BR')}
            </p>
            <p>
              <strong>Horário:</strong> {selectedEvent.startTime}
            </p>
            {selectedEvent.partyFlyerUrl && (
              <img
                src={selectedEvent.partyFlyerUrl}
                alt={`Flyer de ${selectedEvent.title}`}
                className="event-details__flyer"
              />
            )}
            {selectedEvent.information && (
              <p className="event-details__info-text">{selectedEvent.information}</p>
            )}
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setSelectedEvent(null)}
          >
            Voltar
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Agenda - ${venueName || 'Local'}`}>
      {loading ? (
        <p className="modal__loading">Carregando agenda...</p>
      ) : error ? (
        <p className="modal__error">{error}</p>
      ) : events.length === 0 ? (
        <p className="modal__empty">Nenhum evento cadastrado</p>
      ) : (
        <ul className="events-list">
          {events.map((event) => (
            <li key={event.id} className="event-item">
              <button
                type="button"
                className="event-item__button"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="event-item__header">
                  <strong className="event-item__title">{event.title}</strong>
                  <time className="event-item__date">
                    {new Date(event.eventDate).toLocaleDateString('pt-BR')}
                  </time>
                </div>
                <time className="event-item__time">{event.startTime}</time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
