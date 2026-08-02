import { useEffect, useRef, useState } from 'react';

import { API_BASE_URL, getToken } from '../api/client';

export function useVenuePresence(venueId, initialPeople, enabled) {
  const [people, setPeople] = useState(initialPeople || []);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    setPeople(initialPeople || []);
  }, [initialPeople]);

  useEffect(() => {
    if (!enabled || !venueId) return;

    const token = getToken();
    if (!token) return;

    const url = `${API_BASE_URL}/venues/${venueId}/presence/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('checkin', (event) => {
      try {
        const person = JSON.parse(event.data);
        setPeople((prev) => {
          if (prev.some((p) => p.id === person.id)) {
            return prev;
          }
          return [person, ...prev];
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener('checkout', (event) => {
      try {
        const data = JSON.parse(event.data);
        setPeople((prev) => prev.filter((p) => p.id !== data.id));
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects; no action needed
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [venueId, enabled]);

  return people;
}
