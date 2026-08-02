import { z } from 'zod';

import { pool } from '../config/db.js';

const venueParamSchema = z.object({
  venueId: z.coerce.number().int().positive(),
});

const venuesQuerySchema = z.object({
  lat: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
    z.number().min(-90).max(90).optional()
  ),
  lng: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
    z.number().min(-180).max(180).optional()
  ),
  radiusKm: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? 20 : Number(value)),
    z.number().positive().max(200)
  ),
  city: z.string().trim().min(2).max(120).optional(),
});

export async function listVenues(req, res) {
  const parsedQuery = venuesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Coordenadas invalidas.' });
  }

  const hasLocation = Number.isFinite(parsedQuery.data.lat) && Number.isFinite(parsedQuery.data.lng);
  const cityFilter = parsedQuery.data.city || '';

  try {
    let rows;

    if (hasLocation) {
      const [locationRows] = await pool.query(
        `select
          v.id,
          v.name,
          v.address,
          v.partner_status as partnerStatus,
          v.category,
          e.logo_url as establishmentLogoUrl,
          v.created_at as createdAt,
          round(
            6371 * acos(
              least(
                1,
                greatest(
                  -1,
                  cos(radians(?)) * cos(radians(v.lat)) * cos(radians(v.lng) - radians(?)) +
                    sin(radians(?)) * sin(radians(v.lat))
                )
              )
            ),
            2
          ) as distanceKm
        from venues v
        left join establishments e on e.id = v.establishment_id
        where v.lat is not null and v.lng is not null
          ${cityFilter ? 'and v.address like ?' : ''}
        having distanceKm <= ?
        order by
          distanceKm asc,
          v.created_at desc`,
        cityFilter
          ? [parsedQuery.data.lat, parsedQuery.data.lng, parsedQuery.data.lat, `%${cityFilter}%`, parsedQuery.data.radiusKm]
          : [parsedQuery.data.lat, parsedQuery.data.lng, parsedQuery.data.lat, parsedQuery.data.radiusKm]
      );

      rows = locationRows;
      console.log(
        `[debug] listVenues params lat=${parsedQuery.data.lat} lng=${parsedQuery.data.lng} radiusKm=${parsedQuery.data.radiusKm} rows=${Array.isArray(locationRows) ? locationRows.length : 0}`
      );

      // Debug: run the same SQL with values inlined to compare prepared vs raw execution
      try {
        const rawSql = `select v.id, v.name, v.address, v.partner_status as partnerStatus, v.category, e.logo_url as establishmentLogoUrl, v.created_at as createdAt, round(6371 * acos( least(1, greatest(-1, cos(radians(${Number(
          parsedQuery.data.lat
        )})) * cos(radians(v.lat)) * cos(radians(v.lng) - radians(${Number(parsedQuery.data.lng)})) + sin(radians(${Number(parsedQuery.data.lat)})) * sin(radians(v.lat)) ) ) ), 2) as distanceKm from venues v left join establishments e on e.id = v.establishment_id where v.lat is not null and v.lng is not null having distanceKm <= ${Number(parsedQuery.data.radiusKm)} order by distanceKm asc, v.created_at desc`;

        const [rawRows] = await pool.query(rawSql);
        console.log(
          `[debug] listVenues rawSql rows=${Array.isArray(rawRows) ? rawRows.length : 0}`
        );
      } catch (err) {
        console.error('[debug] listVenues rawSql error', err && err.message ? err.message : err);
      }
    } else {
      const [defaultRows] = await pool.query(
        `select
          v.id,
          v.name,
          v.address,
          v.partner_status as partnerStatus,
          v.category,
          e.logo_url as establishmentLogoUrl,
          v.created_at as createdAt
        from venues v
        left join establishments e on e.id = v.establishment_id
        ${cityFilter ? 'where v.address like ?' : ''}
        order by v.created_at desc`,
        cityFilter ? [`%${cityFilter}%`] : []
      );

      rows = defaultRows;
    }

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar venues.' });
  }
}

export async function listVenueCities(req, res) {
  try {
    const [rows] = await pool.query(
      `select distinct
        trim(substring_index(substring_index(v.address, ',', -2), ',', 1)) as city
      from venues v
      where v.address is not null and v.address != ''
        and v.lat is not null and v.lng is not null
      having city is not null and city != ''
      order by city asc`
    );

    const cities = rows.map((row) => row.city).filter(Boolean);
    return res.json(cities);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar cidades.' });
  }
}

export async function listPeopleInVenue(req, res) {
  const parsed = venueParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ message: 'venueId invalido.' });
  }

  try {
    const [requesterCheckin] = await pool.query(
      `select id from checkins
       where user_id = ? and venue_id = ? and active = 1
       limit 1`,
      [req.user.id, parsed.data.venueId]
    );

    if (!requesterCheckin.length) {
      return res.status(403).json({ message: 'Sem permissao para ver este local.' });
    }

    const [rows] = await pool.query(
      `select
        p.user_id as id,
        p.name,
        p.age,
        p.photo_urls as photoUrls,
        p.status_social as statusSocial,
        case
          when exists (
            select 1 from premium_subscriptions ps
            where ps.user_id = p.user_id
              and ps.status = 'active'
              and ps.ends_at > current_timestamp
          ) then 1
          else 0
        end as premiumStatus,
        c.checked_in_at as checkedInAt
      from profiles p
      join checkins c on c.user_id = p.user_id
      where c.venue_id = ? and c.active = 1
      order by c.checked_in_at desc`,
      [parsed.data.venueId]
    );

    const normalizedRows = rows.map((row) => {
      let photoUrls = [];

      if (Array.isArray(row.photoUrls)) {
        photoUrls = row.photoUrls;
      } else if (typeof row.photoUrls === 'string') {
        try {
          const parsed = JSON.parse(row.photoUrls);
          photoUrls = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          photoUrls = [];
        }
      }

      return {
        ...row,
        photoUrls,
      };
    });

    return res.json(normalizedRows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar pessoas do local.' });
  }
}

export async function getVenueMenu(req, res) {
  const parsed = venueParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ message: 'venueId invalido.' });
  }

  try {
    const [venueRows] = await pool.query(
      `select establishment_id as establishmentId
       from venues
       where id = ?
       limit 1`,
      [parsed.data.venueId]
    );

    if (!venueRows.length || !venueRows[0].establishmentId) {
      return res.json([]);
    }

    const [rows] = await pool.query(
      `select
        id,
        name,
        description,
        price,
        category,
        image_url as imageUrl
      from establishment_menu_items
      where establishment_id = ?
      order by created_at desc, id desc`,
      [venueRows[0].establishmentId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar cardapio do venue.' });
  }
}

export async function getVenueDetails(req, res) {
  const parsed = venueParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ message: 'venueId invalido.' });
  }

  try {
    // Get venue and establishment details
    const [venueRows] = await pool.query(
      `select
        v.id,
        v.name,
        e.id as establishmentId,
        e.gallery_urls as galleryUrls
      from venues v
      left join establishments e on e.id = v.establishment_id
      where v.id = ?
      limit 1`,
      [parsed.data.venueId]
    );

    if (!venueRows.length) {
      return res.status(404).json({ message: 'Venue nao encontrado.' });
    }

    const venue = venueRows[0];
    let galleryUrls = [];

    if (Array.isArray(venue.galleryUrls)) {
      galleryUrls = venue.galleryUrls;
    } else if (typeof venue.galleryUrls === 'string' && venue.galleryUrls.trim()) {
      try {
        const parsed = JSON.parse(venue.galleryUrls);
        galleryUrls = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        galleryUrls = [];
      }
    }

    // Get agenda events if establishment exists
    let agendaEvents = [];
    if (venue.establishmentId) {
      const [eventRows] = await pool.query(
        `select
          id,
          event_date as eventDate,
          start_time as startTime,
          title,
          information,
          party_flyer_url as partyFlyerUrl
        from establishment_agenda_events
        where establishment_id = ?
          and event_date >= date_sub(curdate(), interval weekday(curdate()) day)
          and event_date <= date_add(date_sub(curdate(), interval weekday(curdate()) day), interval 6 day)
        order by event_date asc, start_time asc`,
        [venue.establishmentId]
      );

      agendaEvents = eventRows;
    }

    return res.json({
      id: venue.id,
      name: venue.name,
      galleryUrls,
      agendaEvents,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar detalhes do venue.' });
  }
}

export async function getRadar(req, res) {
  try {
    const [profileRows] = await pool.query(
      `select exists (
        select 1 from premium_subscriptions
        where user_id = ?
          and status = 'active'
          and ends_at > current_timestamp
      ) as premiumStatus`,
      [req.user.id]
    );

    if (!profileRows.length || !profileRows[0].premiumStatus) {
      return res.status(403).json({ message: 'Radar disponivel apenas para premium.' });
    }

    const [rows] = await pool.query(
      `select
        v.id,
        v.name,
        count(c.id) as activePeople,
        (
          select p2.status_social
          from profiles p2
          join checkins c2 on c2.user_id = p2.user_id
          where c2.venue_id = v.id and c2.active = 1
          group by p2.status_social
          order by count(*) desc
          limit 1
        ) as predominantStatus
      from venues v
      left join checkins c on c.venue_id = v.id and c.active = 1
      group by v.id, v.name
      order by activePeople desc`
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar radar premium.' });
  }
}

export async function getPublicVenue(req, res) {
  const parsed = venueParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ message: 'venueId invalido.' });
  }

  try {
    const [rows] = await pool.query(
      `select
        v.id,
        v.name,
        v.address,
        v.lat,
        v.lng,
        v.category,
        e.id as establishmentId,
        e.display_name as establishmentName,
        e.logo_url as establishmentLogoUrl,
        e.gallery_urls as galleryUrls,
        e.description,
        e.contact_phone as contactPhone
      from venues v
      left join establishments e on e.id = v.establishment_id
      where v.id = ?
      limit 1`,
      [parsed.data.venueId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Venue nao encontrado.' });
    }

    const venue = rows[0];
    let galleryUrls = [];

    if (Array.isArray(venue.galleryUrls)) {
      galleryUrls = venue.galleryUrls;
    } else if (typeof venue.galleryUrls === 'string' && venue.galleryUrls.trim()) {
      try {
        galleryUrls = JSON.parse(venue.galleryUrls);
      } catch {
        galleryUrls = [];
      }
    }

    let agendaEvents = [];
    if (venue.establishmentId) {
      const [eventRows] = await pool.query(
        `select
          id,
          event_date as eventDate,
          start_time as startTime,
          title,
          information,
          party_flyer_url as partyFlyerUrl
        from establishment_agenda_events
        where establishment_id = ?
          and event_date >= curdate()
        order by event_date asc, start_time asc
        limit 10`,
        [venue.establishmentId]
      );
      agendaEvents = eventRows;
    }

    return res.json({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      lat: venue.lat,
      lng: venue.lng,
      category: venue.category,
      establishmentName: venue.establishmentName,
      establishmentLogoUrl: venue.establishmentLogoUrl,
      galleryUrls,
      description: venue.description,
      contactPhone: venue.contactPhone,
      agendaEvents,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar venue.' });
  }
}
