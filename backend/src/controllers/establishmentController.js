import { z } from 'zod';

import { pool } from '../config/db.js';

const establishmentProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  address: z.string().trim().max(220).optional().or(z.literal('')),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  logoUrl: z.string().trim().max(255).optional().or(z.literal('')),
  galleryUrls: z.array(z.string().trim().max(255)).max(10).optional(),
  contactEmail: z.string().trim().email().max(190).optional().or(z.literal('')),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  instagramUrl: z.string().trim().max(255).optional().or(z.literal('')),
  websiteUrl: z.string().trim().max(255).optional().or(z.literal('')),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  locationConfirmed: z.boolean().optional(),
});

const venueSearchSchema = z.object({
  city: z.string().trim().max(120).optional(),
  q: z.string().trim().max(200).optional(),
});

const requestVenueSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  address: z.string().trim().max(220).optional().or(z.literal('')),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  requestNote: z.string().trim().max(2000).optional().or(z.literal('')),
  requestDocuments: z.array(z.string().trim().max(5000000)).max(10).optional(),
});

const requestVenueLinkSchema = z.object({
  venueId: z.coerce.number().int().positive(),
  requestNote: z.string().trim().max(2000).optional().or(z.literal('')),
  requestDocuments: z.array(z.string().trim().max(5000000)).max(10).optional(),
});

const establishmentAgendaQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const establishmentAgendaEventSchema = z.object({
  eventDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(2).max(180),
  information: z.string().trim().max(2000).optional().or(z.literal('')),
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  partyFlyerUrl: z.string().trim().max(5000000).optional().or(z.literal('')),
});

const establishmentAgendaEventParamSchema = z.object({
  eventId: z.coerce.number().int().positive(),
});

async function ensureEstablishmentRecord(userId) {
  const [existingRows] = await pool.query(
    `select id
     from establishments
     where user_id = ?
     limit 1`,
    [userId]
  );

  const existing = existingRows[0];
  if (existing) {
    return existing.id;
  }

  const [userRows] = await pool.query(
    `select name, email
     from users
     where id = ?
     limit 1`,
    [userId]
  );

  const user = userRows[0];
  const displayName = user?.name || 'Estabelecimento';
  const contactEmail = user?.email || null;

  const [insertResult] = await pool.query(
    `insert into establishments (user_id, display_name, contact_email)
     values (?, ?, ?)`,
    [userId, displayName, contactEmail]
  );

  return insertResult.insertId;
}

async function loadEstablishmentProfile(userId) {
  const [rows] = await pool.query(
    `select
      id,
      user_id as userId,
      display_name as displayName,
      city,
      address,
      lat,
      lng,
      location_confirmed as locationConfirmed,
      category,
      description,
      logo_url as logoUrl,
      gallery_urls as galleryUrls,
      contact_email as contactEmail,
      contact_phone as contactPhone,
      instagram_url as instagramUrl,
      website_url as websiteUrl,
      created_at as createdAt,
      updated_at as updatedAt
    from establishments
    where user_id = ?
    limit 1`,
    [userId]
  );

  const profile = rows[0] || null;
  if (!profile) {
    return null;
  }

  if (!Array.isArray(profile.galleryUrls)) {
    profile.galleryUrls = [];
  }

  return profile;
}

async function hasApprovedVenueLink(establishmentId) {
  const [rows] = await pool.query(
    `select id
     from venues
     where establishment_id = ?
       and establishment_link_status = 'approved'
     limit 1`,
    [establishmentId]
  );

  return Boolean(rows[0]);
}

async function loadEstablishmentAgendaEvent(establishmentId, eventId) {
  const [rows] = await pool.query(
    `select
      id,
      establishment_id as establishmentId,
      event_date as eventDate,
      start_time as startTime,
      title,
      information,
      party_flyer_url as partyFlyerUrl,
      created_at as createdAt,
      updated_at as updatedAt
    from establishment_agenda_events
    where id = ?
      and establishment_id = ?
    limit 1`,
    [eventId, establishmentId]
  );

  return rows[0] || null;
}

export async function getEstablishmentProfile(req, res) {
  try {
    await ensureEstablishmentRecord(req.user.id);
    const profile = await loadEstablishmentProfile(req.user.id);
    return res.json(profile);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar perfil do estabelecimento.' });
  }
}

export async function upsertEstablishmentProfile(req, res) {
  const parsed = establishmentProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para o estabelecimento.' });
  }

  const payload = parsed.data;

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);

    await pool.query(
      `update establishments
       set display_name = ?,
           city = ?,
           address = ?,
           lat = ?,
           lng = ?,
           location_confirmed = ?,
           category = ?,
           description = ?,
           logo_url = ?,
           gallery_urls = ?,
           contact_email = ?,
           contact_phone = ?,
           instagram_url = ?,
           website_url = ?
       where id = ?`,
      [
        payload.displayName,
        payload.city,
        payload.address || null,
        payload.lat ?? null,
        payload.lng ?? null,
        payload.locationConfirmed ? 1 : 0,
        payload.category || null,
        payload.description || null,
        payload.logoUrl || null,
        JSON.stringify(payload.galleryUrls || []),
        payload.contactEmail || null,
        payload.contactPhone || null,
        payload.instagramUrl || null,
        payload.websiteUrl || null,
        establishmentId,
      ]
    );

    const profile = await loadEstablishmentProfile(req.user.id);
    return res.json(profile);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao salvar perfil do estabelecimento.' });
  }
}

export async function searchVenuesForLink(req, res) {
  const parsed = venueSearchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Filtros invalidos para busca de locais.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const where = ['(venues.establishment_id is null or venues.establishment_id = ?)'];
    const values = [establishmentId];

    if (parsed.data.city) {
      where.push('lower(venues.city) = lower(?)');
      values.push(parsed.data.city);
    }

    if (parsed.data.q) {
      where.push('concat_ws(" ", venues.name, venues.city, coalesce(venues.address, ""), coalesce(venues.category, "")) like ?');
      values.push(`%${parsed.data.q}%`);
    }

    const [rows] = await pool.query(
      `select
        venues.id,
        venues.name,
        venues.city,
        venues.address,
        venues.lat,
        venues.lng,
        venues.category,
        venues.partner_status as partnerStatus,
        venues.establishment_link_status as establishmentLinkStatus,
        venues.establishment_id as establishmentId,
        venues.created_at as createdAt
      from venues
      where ${where.join(' and ')}
      order by venues.created_at desc
      limit 80`,
      values
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao buscar locais para vinculacao.' });
  }
}

export async function listEstablishmentVenueRequests(req, res) {
  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);

    const [rows] = await pool.query(
      `select
        id,
        name,
        city,
        address,
        category,
        partner_status as partnerStatus,
        establishment_link_status as establishmentLinkStatus,
        establishment_link_requested_at as establishmentLinkRequestedAt,
        establishment_link_approved_at as establishmentLinkApprovedAt,
        created_at as createdAt
      from venues
      where establishment_id = ?
      order by created_at desc`,
      [establishmentId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar solicitacoes de vinculo.' });
  }
}

export async function requestNewVenue(req, res) {
  const parsed = requestVenueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para solicitar novo local.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);

    const [insertResult] = await pool.query(
      `insert into venues (
        name,
        city,
        address,
        lat,
        lng,
        partner_status,
        category,
        establishment_id,
        establishment_link_status,
        establishment_link_note,
        establishment_link_documents,
        establishment_link_requested_at,
        establishment_link_approved_at
      )
      values (?, ?, ?, ?, ?, 0, ?, ?, 'pending', ?, ?, current_timestamp, null)`,
      [
        parsed.data.name,
        parsed.data.city,
        parsed.data.address || null,
        parsed.data.lat,
        parsed.data.lng,
        parsed.data.category || null,
        establishmentId,
        parsed.data.requestNote || null,
        JSON.stringify(parsed.data.requestDocuments || []),
      ]
    );

    const [rows] = await pool.query(
      `select
        id,
        name,
        city,
        address,
        category,
        partner_status as partnerStatus,
        establishment_link_status as establishmentLinkStatus,
        establishment_link_requested_at as establishmentLinkRequestedAt,
        establishment_link_approved_at as establishmentLinkApprovedAt,
        created_at as createdAt
      from venues
      where id = ?
      limit 1`,
      [insertResult.insertId]
    );

    return res.status(201).json(rows[0] || null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao solicitar cadastro de novo local.' });
  }
}

export async function requestVenueLink(req, res) {
  const parsed = requestVenueLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Local invalido para vinculacao.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);

    const [venueRows] = await pool.query(
      `select id, establishment_id as establishmentId, establishment_link_status as establishmentLinkStatus
       from venues
       where id = ?
       limit 1`,
      [parsed.data.venueId]
    );

    const venue = venueRows[0];
    if (!venue) {
      return res.status(404).json({ message: 'Local nao encontrado.' });
    }

    if (venue.establishmentId && venue.establishmentId !== establishmentId) {
      return res.status(409).json({ message: 'Este local ja esta vinculado a outro estabelecimento.' });
    }

    if (venue.establishmentId === establishmentId && venue.establishmentLinkStatus === 'approved') {
      return res.status(400).json({ message: 'Este local ja esta vinculado e aprovado para seu estabelecimento.' });
    }

    await pool.query(
      `update venues
       set establishment_id = ?,
           establishment_link_status = 'pending',
           establishment_link_note = ?,
           establishment_link_documents = ?,
           establishment_link_requested_at = current_timestamp,
           establishment_link_approved_at = null
       where id = ?`,
      [
        establishmentId,
        parsed.data.requestNote || null,
        JSON.stringify(parsed.data.requestDocuments || []),
        parsed.data.venueId,
      ]
    );

    const [rows] = await pool.query(
      `select
        id,
        name,
        city,
        address,
        category,
        partner_status as partnerStatus,
        establishment_link_status as establishmentLinkStatus,
        establishment_link_requested_at as establishmentLinkRequestedAt,
        establishment_link_approved_at as establishmentLinkApprovedAt,
        created_at as createdAt
      from venues
      where id = ?
      limit 1`,
      [parsed.data.venueId]
    );

    return res.json(rows[0] || null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao solicitar vinculacao de local.' });
  }
}

export async function listEstablishmentAgenda(req, res) {
  const parsed = establishmentAgendaQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Filtro de agenda invalido.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Agenda disponivel apenas para estabelecimento com vinculacao aprovada.' });
    }

    const now = new Date();
    const year = parsed.data.year || now.getFullYear();
    const month = parsed.data.month || now.getMonth() + 1;

    const rangeStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthDate = new Date(year, month, 1);
    const rangeEnd = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const [rows] = await pool.query(
      `select
        id,
        establishment_id as establishmentId,
        event_date as eventDate,
        start_time as startTime,
        title,
        information,
        party_flyer_url as partyFlyerUrl,
        created_at as createdAt,
        updated_at as updatedAt
      from establishment_agenda_events
      where establishment_id = ?
        and event_date >= ?
        and event_date < ?
      order by event_date asc, start_time asc, title asc`,
      [establishmentId, rangeStart, rangeEnd]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar agenda do estabelecimento.' });
  }
}

export async function createEstablishmentAgendaEvent(req, res) {
  const parsed = establishmentAgendaEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para evento da agenda.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Agenda disponivel apenas para estabelecimento com vinculacao aprovada.' });
    }

    const payload = parsed.data;

    const [insertResult] = await pool.query(
      `insert into establishment_agenda_events (
        establishment_id,
        event_date,
        start_time,
        title,
        information,
        party_flyer_url
      ) values (?, ?, ?, ?, ?, ?)`,
      [
        establishmentId,
        payload.eventDate,
        `${payload.startTime}:00`,
        payload.title,
        payload.information || null,
        payload.partyFlyerUrl || null,
      ]
    );

    const [rows] = await pool.query(
      `select
        id,
        establishment_id as establishmentId,
        event_date as eventDate,
        start_time as startTime,
        title,
        information,
        party_flyer_url as partyFlyerUrl,
        created_at as createdAt,
        updated_at as updatedAt
      from establishment_agenda_events
      where id = ?
      limit 1`,
      [insertResult.insertId]
    );

    return res.status(201).json(rows[0] || null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao salvar evento na agenda.' });
  }
}

export async function updateEstablishmentAgendaEvent(req, res) {
  const parsedParams = establishmentAgendaEventParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Evento de agenda inválido.' });
  }

  const parsedBody = establishmentAgendaEventSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Dados inválidos para evento da agenda.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Agenda disponível apenas para estabelecimento com vinculação aprovada.' });
    }

    const existing = await loadEstablishmentAgendaEvent(establishmentId, parsedParams.data.eventId);
    if (!existing) {
      return res.status(404).json({ message: 'Evento não encontrado na agenda.' });
    }

    const payload = parsedBody.data;

    await pool.query(
      `update establishment_agenda_events
       set event_date = ?,
           start_time = ?,
           title = ?,
           information = ?,
           party_flyer_url = ?
       where id = ?
         and establishment_id = ?`,
      [
        payload.eventDate,
        `${payload.startTime}:00`,
        payload.title,
        payload.information || null,
        payload.partyFlyerUrl || null,
        parsedParams.data.eventId,
        establishmentId,
      ]
    );

    const updated = await loadEstablishmentAgendaEvent(establishmentId, parsedParams.data.eventId);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar evento da agenda.' });
  }
}

export async function deleteEstablishmentAgendaEvent(req, res) {
  const parsedParams = establishmentAgendaEventParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Evento de agenda inválido.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Agenda disponível apenas para estabelecimento com vinculação aprovada.' });
    }

    const existing = await loadEstablishmentAgendaEvent(establishmentId, parsedParams.data.eventId);
    if (!existing) {
      return res.status(404).json({ message: 'Evento não encontrado na agenda.' });
    }

    await pool.query(
      `delete from establishment_agenda_events
       where id = ?
         and establishment_id = ?`,
      [parsedParams.data.eventId, establishmentId]
    );

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir evento da agenda.' });
  }
}
