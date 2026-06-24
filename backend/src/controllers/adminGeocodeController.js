import { z } from 'zod';

const geocodeQuerySchema = z.object({
  q: z.string().trim().min(3),
});

const GEOCODE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const geocodeCache = new Map();
const NOMINATIM_COOLDOWN_MS = 2 * 60 * 1000;
let nominatimBlockedUntil = 0;

function normalizeQueryVariants(rawQuery) {
  const normalized = String(rawQuery || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return [];
  }

  const noDiacritics = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const compact = noDiacritics.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

  const variants = [normalized, noDiacritics, compact].filter(Boolean);

  if (!/\bbrasil\b/i.test(normalized)) {
    variants.push(`${normalized}, Brasil`);
  }

  const firstComma = normalized.split(',').map((part) => part.trim()).filter(Boolean);
  if (firstComma.length > 1) {
    variants.push(firstComma.slice().reverse().join(', '));
  }

  return [...new Set(variants)];
}

async function requestJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'bilhete-admin/1.0 (local-dev)',
        Accept: 'application/json',
      },
    });

    if (response.status === 429) {
      return { rateLimited: true, payload: null };
    }

    if (!response.ok) {
      return { rateLimited: false, payload: null };
    }

    const payload = await response.json();
    return { rateLimited: false, payload };
  } finally {
    clearTimeout(timer);
  }
}

function parseNominatim(rows) {
  const first = Array.isArray(rows) ? rows[0] : null;
  if (!first) {
    return null;
  }

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    displayName: first.display_name || '',
    provider: 'nominatim',
  };
}

function parseArcGis(payload) {
  const first = Array.isArray(payload?.candidates) ? payload.candidates[0] : null;
  const location = first?.location;
  if (!location) {
    return null;
  }

  const lng = Number(location.x);
  const lat = Number(location.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    displayName: first.address || first.attributes?.Match_addr || '',
    provider: 'arcgis',
  };
}

export async function geocodeAdminAddress(req, res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });

  const parsed = geocodeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Endereco invalido para geocodificacao.' });
  }

  const cached = geocodeCache.get(parsed.data.q);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.value);
  }

  const queryVariants = normalizeQueryVariants(parsed.data.q);

  try {
    for (const variant of queryVariants) {
      const encoded = encodeURIComponent(variant);

      const now = Date.now();
      const canUseNominatim = now >= nominatimBlockedUntil;

      if (canUseNominatim) {
        const nominatimStrict = await requestJson(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=pt-BR&countrycodes=br&dedupe=1&q=${encoded}`
        );
        if (nominatimStrict?.rateLimited) {
          nominatimBlockedUntil = Date.now() + NOMINATIM_COOLDOWN_MS;
        } else {
          const strictMatch = parseNominatim(nominatimStrict?.payload);
          if (strictMatch) {
            geocodeCache.set(parsed.data.q, { expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS, value: strictMatch });
            return res.json(strictMatch);
          }
        }

        const nominatimLoose = await requestJson(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=pt-BR&dedupe=1&q=${encoded}`
        );
        if (nominatimLoose?.rateLimited) {
          nominatimBlockedUntil = Date.now() + NOMINATIM_COOLDOWN_MS;
        } else {
          const looseMatch = parseNominatim(nominatimLoose?.payload);
          if (looseMatch) {
            geocodeCache.set(parsed.data.q, { expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS, value: looseMatch });
            return res.json(looseMatch);
          }
        }
      }

      const arcGis = await requestJson(
        `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=pjson&singleLine=${encoded}&countryCode=BRA&maxLocations=1&outFields=Match_addr,Addr_type`
      );
      const arcGisMatch = parseArcGis(arcGis?.payload);
      if (arcGisMatch) {
        geocodeCache.set(parsed.data.q, { expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS, value: arcGisMatch });
        return res.json(arcGisMatch);
      }
    }

    geocodeCache.set(parsed.data.q, { expiresAt: Date.now() + 60 * 1000, value: null });
    return res.json(null);
  } catch (error) {
    return res.status(502).json({ message: 'Falha ao consultar servico de geocodificacao.' });
  }
}
