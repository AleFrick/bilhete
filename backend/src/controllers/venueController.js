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
});

export async function listVenues(req, res) {
  const parsedQuery = venuesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Coordenadas invalidas.' });
  }

  const hasLocation = Number.isFinite(parsedQuery.data.lat) && Number.isFinite(parsedQuery.data.lng);

  try {
    let rows;

    if (hasLocation) {
      const [locationRows] = await pool.query(
        `select
          id,
          name,
          address,
          partner_status as partnerStatus,
          category,
          created_at as createdAt,
          round(
            6371 * acos(
              least(
                1,
                greatest(
                  -1,
                  cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) +
                    sin(radians(?)) * sin(radians(lat))
                )
              )
            ),
            2
          ) as distanceKm
        from venues
        where lat is not null and lng is not null
        having distanceKm <= ?
        order by
          distanceKm asc,
          created_at desc`,
        [parsedQuery.data.lat, parsedQuery.data.lng, parsedQuery.data.lat, parsedQuery.data.radiusKm]
      );

      rows = locationRows;
    } else {
      const [defaultRows] = await pool.query(
        `select
          id,
          name,
          address,
          partner_status as partnerStatus,
          category,
          created_at as createdAt
        from venues
        order by created_at desc`
      );

      rows = defaultRows;
    }

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar venues.' });
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
        p.premium_status as premiumStatus,
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

export async function getRadar(req, res) {
  try {
    const [profileRows] = await pool.query(
      `select
        case
          when premium_status = 1 and (premium_expires_at is null or premium_expires_at > current_timestamp)
            then 1
          else 0
        end as premiumStatus
      from profiles
      where user_id = ?
      limit 1`,
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
