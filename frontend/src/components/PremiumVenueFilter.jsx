import { useEffect, useState } from 'react';

import { api } from '../api/client';

export default function PremiumVenueFilter({ onFilterChange }) {
  const [city, setCity] = useState('');
  const [radiusKm, setRadiusKm] = useState(20);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await api.venueCities();
        if (!cancelled && Array.isArray(data)) {
          setCities(data);
        }
      } catch {
        // ignore
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({ city: city || undefined, radiusKm });
    }
  }, [city, radiusKm, onFilterChange]);

  return (
    <div className="explore-filters" style={{ marginTop: '12px' }}>
      <label style={{ display: 'block', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cidade</span>
        <select
          value={city}
          onChange={(event) => setCity(event.target.value)}
          style={{
            width: '100%',
            marginTop: '4px',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: 'var(--text)',
          }}
        >
          <option value="">Todas as cidades</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'block' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Distancia maxima: {radiusKm} km
        </span>
        <input
          type="range"
          min="1"
          max="200"
          step="1"
          value={radiusKm}
          onChange={(event) => setRadiusKm(Number(event.target.value))}
          style={{ width: '100%', marginTop: '4px' }}
        />
      </label>
    </div>
  );
}
