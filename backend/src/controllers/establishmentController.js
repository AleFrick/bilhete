import { z } from 'zod';

import { pool } from '../config/db.js';
import { validateImageDataUrl, validateImageDataUrls } from '../middleware/imageValidation.js';

const establishmentProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  address: z.string().trim().max(220).optional().or(z.literal('')),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  logoUrl: z.string().trim().max(5000000).optional().or(z.literal('')),
  galleryUrls: z.array(z.string().trim().max(5000000)).max(10).optional(),
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
  analyticsMetadata: z.record(z.string().trim().max(80), z.string().trim().max(160)).optional(),
});

const establishmentAgendaEventParamSchema = z.object({
  eventId: z.coerce.number().int().positive(),
});

const establishmentAgendaStatsQuerySchema = z.object({
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
});

const establishmentMenuItemSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  price: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  category: z.string().trim().max(120).optional().or(z.literal('')),
  imageUrl: z.string().trim().max(5000000).optional().or(z.literal('')),
});

const establishmentMenuItemParamSchema = z.object({
  itemId: z.coerce.number().int().positive(),
});

function normalizeAnalyticsMetadata(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  return {};
}

function sanitizeAnalyticsMetadata(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const entries = Object.entries(source)
    .map(([key, entryValue]) => [String(key || '').trim(), String(entryValue || '').trim()])
    .filter(([key, entryValue]) => key && entryValue)
    .slice(0, 40);

  return Object.fromEntries(entries);
}

function normalizeAgendaEventRow(row) {
  return {
    ...row,
    analyticsMetadata: normalizeAnalyticsMetadata(row.analyticsMetadata),
  };
}

function normalizeMenuItemPrice(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const source = typeof value === 'number' ? String(value) : String(value).trim();
  if (!source) {
    return null;
  }

  const sanitized = source.replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  if (!sanitized) {
    return null;
  }

  const hasComma = sanitized.includes(',');
  const hasDot = sanitized.includes('.');

  let normalized = sanitized;
  if (hasComma && hasDot) {
    const lastComma = sanitized.lastIndexOf(',');
    const lastDot = sanitized.lastIndexOf('.');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = sanitized
      .replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '')
      .replace(decimalSeparator, '.');
  } else if (hasComma) {
    normalized = sanitized.replace(',', '.');
  } else if (hasDot) {
    const dotCount = sanitized.split('.').length - 1;
    if (dotCount > 1) {
      normalized = sanitized.replace(/\./g, '');
    }
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed.toFixed(2);
}

function normalizeMenuItemRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price === null ? null : String(row.price),
    category: row.category,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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
  if (!user) {
    throw new Error('Usuario nao encontrado.');
  }

  const [claimableRows] = await pool.query(
    `select id
     from establishments
     where user_id is null
       and (contact_email is null or contact_email = ?)
     order by created_at asc
     limit 1`,
    [user.email || null]
  );

  const claimable = claimableRows[0];
  if (claimable) {
    await pool.query(
      `update establishments
       set user_id = ?,
           display_name = coalesce(display_name, ?),
           contact_email = coalesce(contact_email, ?)
       where id = ?`,
      [userId, user.name || 'Estabelecimento', user.email || null, claimable.id]
    );

    return claimable.id;
  }

  const displayName = user.name || 'Estabelecimento';
  const contactEmail = user.email || null;

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

async function hasActivePremium(userId) {
  const [rows] = await pool.query(
    `select 1
     from premium_subscriptions
     where user_id = ?
       and target_group = 'establishment'
       and status = 'active'
       and ends_at > current_timestamp
     limit 1`,
    [userId]
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
      analytics_metadata as analyticsMetadata,
      created_at as createdAt,
      updated_at as updatedAt
    from establishment_agenda_events
    where id = ?
      and establishment_id = ?
    limit 1`,
    [eventId, establishmentId]
  );

  if (!rows[0]) {
    return null;
  }

  return normalizeAgendaEventRow(rows[0]);
}

async function loadEstablishmentMenuItem(establishmentId, itemId) {
  const [rows] = await pool.query(
    `select
      id,
      establishment_id as establishmentId,
      name,
      description,
      price,
      category,
      category,
      image_url as imageUrl,
      created_at as createdAt,
      updated_at as updatedAt
    from establishment_menu_items
    where id = ?
      and establishment_id = ?
    limit 1`,
    [itemId, establishmentId]
  );

  return rows[0] ? normalizeMenuItemRow(rows[0]) : null;
}

export async function listEstablishmentMenuItems(req, res) {
  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Cardápio disponível apenas para estabelecimento com vinculação aprovada.' });
    }
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Cardápio disponível apenas para estabelecimentos premium.' });
    }

    const [rows] = await pool.query(
      `select
        id,
        establishment_id as establishmentId,
        name,
        description,
        price,
        category,
        image_url as imageUrl,
        created_at as createdAt,
        updated_at as updatedAt
      from establishment_menu_items
      where establishment_id = ?
      order by created_at desc, id desc`,
      [establishmentId]
    );

    return res.json(rows.map(normalizeMenuItemRow));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar cardápio do estabelecimento.' });
  }
}

export async function createEstablishmentMenuItem(req, res) {
  const parsed = establishmentMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados inválidos para o item do cardápio.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Cardápio disponível apenas para estabelecimento com vinculação aprovada.' });
    }
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Cardápio disponível apenas para estabelecimentos premium.' });
    }
    const payload = parsed.data;
    const normalizedPrice = normalizeMenuItemPrice(payload.price);

    const [insertResult] = await pool.query(
      `insert into establishment_menu_items (
        establishment_id,
        name,
        description,
        price,
        category,
        image_url
      ) values (?, ?, ?, ?, ?, ?)` ,
      [
        establishmentId,
        payload.name,
        payload.description || null,
        normalizedPrice,
        payload.category || null,
        payload.imageUrl || null,
      ]
    );

    const item = await loadEstablishmentMenuItem(establishmentId, insertResult.insertId);
    return res.status(201).json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao salvar item do cardápio.' });
  }
}

export async function updateEstablishmentMenuItem(req, res) {
  const parsedParams = establishmentMenuItemParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Item de cardápio inválido.' });
  }

  const parsed = establishmentMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados inválidos para o item do cardápio.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Cardápio disponível apenas para estabelecimento com vinculação aprovada.' });
    }
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Cardápio disponível apenas para estabelecimentos premium.' });
    }
    const existing = await loadEstablishmentMenuItem(establishmentId, parsedParams.data.itemId);
    if (!existing) {
      return res.status(404).json({ message: 'Item do cardápio não encontrado.' });
    }

    const payload = parsed.data;
    const normalizedPrice = normalizeMenuItemPrice(payload.price);

    await pool.query(
      `update establishment_menu_items
       set name = ?,
           description = ?,
           price = ?,
           category = ?,
           image_url = ?
       where id = ?
         and establishment_id = ?`,
      [
        payload.name,
        payload.description || null,
        normalizedPrice,
        payload.category || null,
        payload.imageUrl || null,
        parsedParams.data.itemId,
        establishmentId,
      ]
    );

    const item = await loadEstablishmentMenuItem(establishmentId, parsedParams.data.itemId);
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar item do cardápio.' });
  }
}

export async function deleteEstablishmentMenuItem(req, res) {
  const parsedParams = establishmentMenuItemParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Item de cardápio inválido.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Cardápio disponível apenas para estabelecimento com vinculação aprovada.' });
    }
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Cardápio disponível apenas para estabelecimentos premium.' });
    }
    const existing = await loadEstablishmentMenuItem(establishmentId, parsedParams.data.itemId);
    if (!existing) {
      return res.status(404).json({ message: 'Item do cardápio não encontrado.' });
    }

    await pool.query(
      `delete from establishment_menu_items
       where id = ?
         and establishment_id = ?`,
      [parsedParams.data.itemId, establishmentId]
    );

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir item do cardápio.' });
  }
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

  if (payload.logoUrl) {
    const logoCheck = validateImageDataUrl(payload.logoUrl, { maxBytes: 5 * 1024 * 1024 });
    if (!logoCheck.valid) {
      return res.status(400).json({ message: `Logo: ${logoCheck.error}` });
    }
  }

  if (payload.galleryUrls && payload.galleryUrls.length > 0) {
    const galleryCheck = validateImageDataUrls(payload.galleryUrls, { maxBytes: 5 * 1024 * 1024 });
    if (!galleryCheck.valid) {
      return res.status(400).json({ message: `Galeria: ${galleryCheck.error}` });
    }
  }

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

  if (parsed.data.requestDocuments && parsed.data.requestDocuments.length > 0) {
    const docCheck = validateImageDataUrls(parsed.data.requestDocuments, { maxBytes: 5 * 1024 * 1024 });
    if (!docCheck.valid) {
      return res.status(400).json({ message: `Documentos: ${docCheck.error}` });
    }
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

  if (parsed.data.requestDocuments && parsed.data.requestDocuments.length > 0) {
    const docCheck = validateImageDataUrls(parsed.data.requestDocuments, { maxBytes: 5 * 1024 * 1024 });
    if (!docCheck.valid) {
      return res.status(400).json({ message: `Documentos: ${docCheck.error}` });
    }
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
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Agenda disponivel apenas para estabelecimentos premium.' });
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
        analytics_metadata as analyticsMetadata,
        created_at as createdAt,
        updated_at as updatedAt
      from establishment_agenda_events
      where establishment_id = ?
        and event_date >= ?
        and event_date < ?
      order by event_date asc, start_time asc, title asc`,
      [establishmentId, rangeStart, rangeEnd]
    );

    return res.json(rows.map((row) => normalizeAgendaEventRow(row)));
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
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Agenda disponivel apenas para estabelecimentos premium.' });
    }

    const payload = parsed.data;
    const analyticsMetadata = sanitizeAnalyticsMetadata(payload.analyticsMetadata);

    const [insertResult] = await pool.query(
      `insert into establishment_agenda_events (
        establishment_id,
        event_date,
        start_time,
        title,
        information,
        party_flyer_url,
        analytics_metadata
      ) values (?, ?, ?, ?, ?, ?, ?)`,
      [
        establishmentId,
        payload.eventDate,
        `${payload.startTime}:00`,
        payload.title,
        payload.information || null,
        payload.partyFlyerUrl || null,
        JSON.stringify(analyticsMetadata),
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
        analytics_metadata as analyticsMetadata,
        created_at as createdAt,
        updated_at as updatedAt
      from establishment_agenda_events
      where id = ?
      limit 1`,
      [insertResult.insertId]
    );

    return res.status(201).json(rows[0] ? normalizeAgendaEventRow(rows[0]) : null);
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
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Agenda disponível apenas para estabelecimentos premium.' });
    }

    const existing = await loadEstablishmentAgendaEvent(establishmentId, parsedParams.data.eventId);
    if (!existing) {
      return res.status(404).json({ message: 'Evento não encontrado na agenda.' });
    }

    const payload = parsedBody.data;
    const analyticsMetadata = sanitizeAnalyticsMetadata(payload.analyticsMetadata);

    await pool.query(
      `update establishment_agenda_events
       set event_date = ?,
           start_time = ?,
           title = ?,
           information = ?,
           party_flyer_url = ?,
           analytics_metadata = ?
       where id = ?
         and establishment_id = ?`,
      [
        payload.eventDate,
        `${payload.startTime}:00`,
        payload.title,
        payload.information || null,
        payload.partyFlyerUrl || null,
        JSON.stringify(analyticsMetadata),
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
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Agenda disponível apenas para estabelecimentos premium.' });
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

export async function getEstablishmentAgendaStats(req, res) {
  const parsed = establishmentAgendaStatsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Período inválido para estatísticas.' });
  }

  const { startDate, endDate } = parsed.data;
  if (startDate > endDate) {
    return res.status(400).json({ message: 'Data inicial deve ser menor ou igual à data final.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Estatísticas disponíveis apenas para estabelecimento com vinculação aprovada.' });
    }
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Estatísticas disponíveis apenas para estabelecimentos premium.' });
    }

    const [eventsRows] = await pool.query(
      `select
        id,
        event_date as eventDate,
        analytics_metadata as analyticsMetadata
      from establishment_agenda_events
      where establishment_id = ?
        and event_date >= ?
        and event_date <= ?`,
      [establishmentId, startDate, endDate]
    );

    const endExclusive = `${endDate} 23:59:59`;
    const [checkinsRows] = await pool.query(
      `select
        date(c.checked_in_at) as checkinDate,
        count(*) as total
      from checkins c
      join venues v on v.id = c.venue_id
      where v.establishment_id = ?
        and c.checked_in_at >= ?
        and c.checked_in_at <= ?
      group by date(c.checked_in_at)`,
      [establishmentId, `${startDate} 00:00:00`, endExclusive]
    );

    const checkinsByDate = new Map(
      checkinsRows.map((row) => [String(row.checkinDate).slice(0, 10), Number(row.total || 0)])
    );

    const totals = {
      events: eventsRows.length,
      checkins: 0,
    };

    for (const value of checkinsByDate.values()) {
      totals.checkins += value;
    }

    const metricAccumulator = new Map();

    for (const row of eventsRows) {
      const eventDate = String(row.eventDate || '').slice(0, 10);
      const eventCheckins = checkinsByDate.get(eventDate) || 0;
      const metadata = sanitizeAnalyticsMetadata(normalizeAnalyticsMetadata(row.analyticsMetadata));

      for (const [key, value] of Object.entries(metadata)) {
        const groupKey = `${key}::${value}`;
        if (!metricAccumulator.has(groupKey)) {
          metricAccumulator.set(groupKey, {
            key,
            value,
            eventCount: 0,
            checkins: 0,
          });
        }

        const item = metricAccumulator.get(groupKey);
        item.eventCount += 1;
        item.checkins += eventCheckins;
      }
    }

    const metrics = Array.from(metricAccumulator.values()).sort((a, b) => {
      if (b.checkins !== a.checkins) {
        return b.checkins - a.checkins;
      }

      if (b.eventCount !== a.eventCount) {
        return b.eventCount - a.eventCount;
      }

      return `${a.key}:${a.value}`.localeCompare(`${b.key}:${b.value}`);
    });

    return res.json({
      period: {
        startDate,
        endDate,
      },
      totals,
      metrics,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar estatísticas da agenda.' });
  }
}

const dashboardQuerySchema = z.object({
  startDate: z.string().trim().min(10).max(10),
  endDate: z.string().trim().min(10).max(10),
});

export async function getEstablishmentDashboard(req, res) {
  const parsed = dashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Período inválido para dashboard.' });
  }

  const { startDate, endDate } = parsed.data;
  if (startDate > endDate) {
    return res.status(400).json({ message: 'Data inicial deve ser menor ou igual à data final.' });
  }

  try {
    const establishmentId = await ensureEstablishmentRecord(req.user.id);
    const approved = await hasApprovedVenueLink(establishmentId);
    if (!approved) {
      return res.status(403).json({ message: 'Dashboard disponível apenas para estabelecimento com vinculação aprovada.' });
    }
    const isPremium = await hasActivePremium(req.user.id);
    if (!isPremium) {
      return res.status(403).json({ message: 'Dashboard disponível apenas para estabelecimentos premium.' });
    }

    const startDt = `${startDate} 00:00:00`;
    const endDt = `${endDate} 23:59:59`;

    /* ── Totais gerais ── */
    const [totalsRow] = await pool.query(
      `select
        count(*) as totalCheckins,
        count(distinct c.user_id) as uniqueVisitors,
        count(distinct date(c.checked_in_at)) as activeDays
      from checkins c
      join venues v on v.id = c.venue_id
      where v.establishment_id = ?
        and c.checked_in_at >= ?
        and c.checked_in_at <= ?`,
      [establishmentId, startDt, endDt]
    );

    /* ── Check-ins por dia ── */
    const [checkinsByDayRows] = await pool.query(
      `select
        date(c.checked_in_at) as day,
        count(*) as checkins,
        count(distinct c.user_id) as uniqueVisitors
      from checkins c
      join venues v on v.id = c.venue_id
      where v.establishment_id = ?
        and c.checked_in_at >= ?
        and c.checked_in_at <= ?
      group by date(c.checked_in_at)
      order by day asc`,
      [establishmentId, startDt, endDt]
    );

    /* ── Check-ins por dia da semana ── */
    const [checkinsByWeekdayRows] = await pool.query(
      `select
        dayofweek(c.checked_in_at) as weekday,
        count(*) as checkins,
        count(distinct c.user_id) as uniqueVisitors
      from checkins c
      join venues v on v.id = c.venue_id
      where v.establishment_id = ?
        and c.checked_in_at >= ?
        and c.checked_in_at <= ?
      group by dayofweek(c.checked_in_at)
      order by weekday asc`,
      [establishmentId, startDt, endDt]
    );

    /* ── Horários de pico (por hora) ── */
    const [checkinsByHourRows] = await pool.query(
      `select
        hour(c.checked_in_at) as hour,
        count(*) as checkins
      from checkins c
      join venues v on v.id = c.venue_id
      where v.establishment_id = ?
        and c.checked_in_at >= ?
        and c.checked_in_at <= ?
      group by hour(c.checked_in_at)
      order by hour asc`,
      [establishmentId, startDt, endDt]
    );

    /* ── Tempo médio de permanência ── */
    const [dwellTimeRow] = await pool.query(
      `select
        avg(timestampdiff(minute, c.checked_in_at, c.checked_out_at)) as avgDwellMinutes,
        count(c.checked_out_at) as completedCheckouts
      from checkins c
      join venues v on v.id = c.venue_id
      where v.establishment_id = ?
        and c.checked_in_at >= ?
        and c.checked_in_at <= ?
        and c.checked_out_at is not null`,
      [establishmentId, startDt, endDt]
    );

    /* ── Novos vs recorrentes ── */
    const [newVsReturningRow] = await pool.query(
      `select
        sum(case when user_first_checkin is null then 1 else 0 end) as newVisitors,
        sum(case when user_first_checkin is not null then 1 else 0 end) as returningVisitors
      from (
        select
          c.user_id,
          min(c.checked_in_at) over (partition by c.user_id) as user_first_checkin,
          c.checked_in_at
        from checkins c
        join venues v on v.id = c.venue_id
        where v.establishment_id = ?
          and c.checked_in_at >= ?
          and c.checked_in_at <= ?
      ) c
      where date(c.checked_in_at) = date(c.user_first_checkin)
         or c.checked_in_at != c.user_first_checkin`,
      [establishmentId, startDt, endDt]
    );

    /* ── Perfil do público (faixa etária) ── */
    const [ageRangeRows] = await pool.query(
      `select
        case
          when p.age is null then 'Não informado'
          when p.age < 18 then 'Menor de 18'
          when p.age between 18 and 24 then '18-24'
          when p.age between 25 and 34 then '25-34'
          when p.age between 35 and 44 then '35-44'
          when p.age >= 45 then '45+'
        end as ageRange,
        count(distinct c.user_id) as visitors
      from checkins c
      join venues v on v.id = c.venue_id
      left join profiles p on p.user_id = c.user_id
      where v.establishment_id = ?
        and c.checked_in_at >= ?
        and c.checked_in_at <= ?
      group by ageRange
      order by visitors desc`,
      [establishmentId, startDt, endDt]
    );

    /* ── Top clientes (mais check-ins) ── */
    const [topClientsRows] = await pool.query(
      `select
        c.user_id as userId,
        p.name as name,
        count(*) as checkinCount,
        max(c.checked_in_at) as lastVisit
      from checkins c
      join venues v on v.id = c.venue_id
      left join profiles p on p.user_id = c.user_id
      where v.establishment_id = ?
        and c.checked_in_at >= ?
        and c.checked_in_at <= ?
      group by c.user_id, p.name
      order by checkinCount desc
      limit 10`,
      [establishmentId, startDt, endDt]
    );

    /* ── Dias com maior movimento (ranking) ── */
    const [topDaysRows] = await pool.query(
      `select
        date(c.checked_in_at) as day,
        count(*) as checkins,
        count(distinct c.user_id) as uniqueVisitors
      from checkins c
      join venues v on v.id = c.venue_id
      where v.establishment_id = ?
        and c.checked_in_at >= ?
        and c.checked_in_at <= ?
      group by date(c.checked_in_at)
      order by checkins desc
      limit 10`,
      [establishmentId, startDt, endDt]
    );

    const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return res.json({
      period: { startDate, endDate },
      totals: {
        totalCheckins: Number(totalsRow[0]?.totalCheckins || 0),
        uniqueVisitors: Number(totalsRow[0]?.uniqueVisitors || 0),
        activeDays: Number(totalsRow[0]?.activeDays || 0),
        avgDwellMinutes: Number(dwellTimeRow[0]?.avgDwellMinutes || 0),
        completedCheckouts: Number(dwellTimeRow[0]?.completedCheckouts || 0),
        newVisitors: Number(newVsReturningRow[0]?.newVisitors || 0),
        returningVisitors: Number(newVsReturningRow[0]?.returningVisitors || 0),
      },
      checkinsByDay: checkinsByDayRows.map((r) => ({
        day: String(r.day).slice(0, 10),
        checkins: Number(r.checkins),
        uniqueVisitors: Number(r.uniqueVisitors),
      })),
      checkinsByWeekday: checkinsByWeekdayRows.map((r) => ({
        weekday: weekdayNames[Number(r.weekday) - 1] || `?${r.weekday}`,
        checkins: Number(r.checkins),
        uniqueVisitors: Number(r.uniqueVisitors),
      })),
      checkinsByHour: checkinsByHourRows.map((r) => ({
        hour: Number(r.hour),
        checkins: Number(r.checkins),
      })),
      ageRange: ageRangeRows.map((r) => ({
        range: r.ageRange,
        visitors: Number(r.visitors),
      })),
      topClients: topClientsRows.map((r) => ({
        userId: r.userId,
        name: r.name || 'Usuário',
        checkinCount: Number(r.checkinCount),
        lastVisit: r.lastVisit,
      })),
      topDays: topDaysRows.map((r) => ({
        day: String(r.day).slice(0, 10),
        checkins: Number(r.checkins),
        uniqueVisitors: Number(r.uniqueVisitors),
      })),
    });
  } catch (error) {
    console.error('[getEstablishmentDashboard]', error);
    return res.status(500).json({ message: 'Erro ao carregar dashboard.' });
  }
}
