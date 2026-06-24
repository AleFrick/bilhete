import { z } from 'zod';

import { pool } from '../config/db.js';

const createVenueSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  address: z.string().trim().max(220).optional().or(z.literal('')),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  partnerStatus: z.boolean().optional(),
  category: z.string().trim().max(80).optional().or(z.literal('')),
});

const venueParamSchema = z.object({
  venueId: z.coerce.number().int().positive(),
});

const adminVenueLinkSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

const adminVenuesQuerySchema = z.object({
  city: z.string().trim().min(2).max(120).optional(),
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
});

const adminVenueLinkRequestsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

let venueLinkDetailsSelectCache = null;

async function getVenueLinkDetailsSelect() {
  if (venueLinkDetailsSelectCache) {
    return venueLinkDetailsSelectCache;
  }

  let columns = [];
  try {
    const [rows] = await pool.query('show columns from venues');
    columns = rows;
  } catch {
    venueLinkDetailsSelectCache = 'null as establishmentLinkNote,\n        null as establishmentLinkDocuments';
    return venueLinkDetailsSelectCache;
  }

  const columnNames = new Set(columns.map((column) => String(column.Field || '').toLowerCase()));

  const noteSelect = columnNames.has('establishment_link_note')
    ? 'venues.establishment_link_note as establishmentLinkNote'
    : 'null as establishmentLinkNote';
  const documentsSelect = columnNames.has('establishment_link_documents')
    ? 'venues.establishment_link_documents as establishmentLinkDocuments'
    : 'null as establishmentLinkDocuments';

  venueLinkDetailsSelectCache = `${noteSelect},\n        ${documentsSelect}`;
  return venueLinkDetailsSelectCache;
}

export async function listAdminVenues(req, res) {
  const parsedQuery = adminVenuesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Filtros invalidos.' });
  }

  const { city, q, category } = parsedQuery.data;

  try {
    const linkDetailsSelect = await getVenueLinkDetailsSelect();
    const where = [];
    const values = [];

    if (city) {
      where.push('lower(venues.city) = lower(?)');
      values.push(city);
    }

    if (category) {
      where.push('lower(coalesce(venues.category, "")) = lower(?)');
      values.push(category);
    }

    if (q) {
      where.push(
        'concat_ws(" ", venues.name, venues.city, coalesce(venues.address, ""), coalesce(venues.category, ""), if(venues.partner_status = 1, "parceiro", ""), coalesce(establishments.display_name, "")) like ?'
      );
      values.push(`%${q}%`);
    }

    const whereSql = where.length ? `where ${where.join(' and ')}` : '';

    const [rows] = await pool.query(
      `select
        venues.id,
        venues.name,
        venues.city,
        venues.address,
        venues.lat,
        venues.lng,
        venues.partner_status as partnerStatus,
        venues.category,
        venues.establishment_link_status as establishmentLinkStatus,
        ${linkDetailsSelect},
        venues.establishment_link_requested_at as establishmentLinkRequestedAt,
        venues.establishment_link_approved_at as establishmentLinkApprovedAt,
        establishments.id as establishmentId,
        establishments.display_name as establishmentName,
        venues.created_at as createdAt
      from venues
      left join establishments on establishments.id = venues.establishment_id
      ${whereSql}
      order by venues.created_at desc`
      ,
      values
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar locais.' });
  }
}

export async function listAdminVenueCities(req, res) {
  try {
    const [rows] = await pool.query(
      `select distinct city
       from venues
       where city is not null and trim(city) <> ''
       order by city asc`
    );

    return res.json(rows.map((row) => row.city));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar cidades.' });
  }
}

export async function listAdminVenueLinkRequests(req, res) {
  const parsedQuery = adminVenueLinkRequestsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Filtros invalidos para pedidos de vinculacao.' });
  }

  const { status } = parsedQuery.data;

  try {
    const where = ["venues.establishment_link_status <> 'none'"];
    const values = [];

    if (status) {
      where.push('venues.establishment_link_status = ?');
      values.push(status);
    }

    const [rows] = await pool.query(
      `select
        venues.id,
        venues.name,
        venues.city,
        venues.address,
        venues.lat,
        venues.lng,
        venues.partner_status as partnerStatus,
        venues.category,
        venues.establishment_link_status as establishmentLinkStatus,
        null as establishmentLinkNote,
        null as establishmentLinkDocuments,
        venues.establishment_link_requested_at as establishmentLinkRequestedAt,
        venues.establishment_link_approved_at as establishmentLinkApprovedAt,
        establishments.id as establishmentId,
        establishments.display_name as establishmentName,
        venues.created_at as createdAt
      from venues
      left join establishments on establishments.id = venues.establishment_id
      where ${where.join(' and ')}
      order by coalesce(venues.establishment_link_requested_at, venues.created_at) desc`,
      values
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar pedidos de vinculacao.' });
  }
}

export async function createAdminVenue(req, res) {
  const parsed = createVenueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para cadastro de local.' });
  }

  const payload = parsed.data;

  try {
    const linkDetailsSelect = await getVenueLinkDetailsSelect();
    const [insertResult] = await pool.query(
      `insert into venues (name, city, address, lat, lng, partner_status, category)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.name,
        payload.city,
        payload.address || null,
        payload.lat,
        payload.lng,
        payload.partnerStatus ? 1 : 0,
        payload.category || null,
      ]
    );

    const [rows] = await pool.query(
      `select
        venues.id,
        venues.name,
        venues.city,
        venues.address,
        venues.lat,
        venues.lng,
        venues.partner_status as partnerStatus,
        venues.category,
        venues.establishment_link_status as establishmentLinkStatus,
        ${linkDetailsSelect},
        venues.establishment_link_requested_at as establishmentLinkRequestedAt,
        venues.establishment_link_approved_at as establishmentLinkApprovedAt,
        establishments.id as establishmentId,
        establishments.display_name as establishmentName,
        venues.created_at as createdAt
      from venues
      left join establishments on establishments.id = venues.establishment_id
      where venues.id = ?
      limit 1`,
      [insertResult.insertId]
    );

    return res.status(201).json(rows[0] || null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao cadastrar local.' });
  }
}

export async function updateAdminVenue(req, res) {
  const parsedParams = venueParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'venueId invalido.' });
  }

  const parsedBody = createVenueSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Dados invalidos para atualizar local.' });
  }

  const payload = parsedBody.data;

  try {
    const linkDetailsSelect = await getVenueLinkDetailsSelect();
    const [updateResult] = await pool.query(
      `update venues
       set name = ?, city = ?, address = ?, lat = ?, lng = ?, partner_status = ?, category = ?
       where id = ?`,
      [
        payload.name,
        payload.city,
        payload.address || null,
        payload.lat,
        payload.lng,
        payload.partnerStatus ? 1 : 0,
        payload.category || null,
        parsedParams.data.venueId,
      ]
    );

    if (!updateResult.affectedRows) {
      return res.status(404).json({ message: 'Local nao encontrado.' });
    }

    const [rows] = await pool.query(
      `select
        venues.id,
        venues.name,
        venues.city,
        venues.address,
        venues.lat,
        venues.lng,
        venues.partner_status as partnerStatus,
        venues.category,
        venues.establishment_link_status as establishmentLinkStatus,
        ${linkDetailsSelect},
        venues.establishment_link_requested_at as establishmentLinkRequestedAt,
        venues.establishment_link_approved_at as establishmentLinkApprovedAt,
        establishments.id as establishmentId,
        establishments.display_name as establishmentName,
        venues.created_at as createdAt
      from venues
      left join establishments on establishments.id = venues.establishment_id
      where venues.id = ?
      limit 1`,
      [parsedParams.data.venueId]
    );

    return res.json(rows[0] || null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar local.' });
  }
}

export async function updateAdminVenueLinkApproval(req, res) {
  const parsedParams = venueParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'venueId invalido.' });
  }

  const parsedBody = adminVenueLinkSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Status de aprovacao invalido.' });
  }

  try {
    const linkDetailsSelect = await getVenueLinkDetailsSelect();
    const [currentRows] = await pool.query(
      `select id, establishment_link_status as establishmentLinkStatus
       from venues
       where id = ?
       limit 1`,
      [parsedParams.data.venueId]
    );

    const currentVenue = currentRows[0];
    if (!currentVenue) {
      return res.status(404).json({ message: 'Local nao encontrado.' });
    }

    if (currentVenue.establishmentLinkStatus !== 'pending') {
      return res.status(400).json({ message: 'Este local nao possui solicitacao pendente.' });
    }

    if (parsedBody.data.status === 'approved') {
      await pool.query(
        `update venues
         set establishment_link_status = 'approved',
             establishment_link_approved_at = current_timestamp,
             partner_status = 1
         where id = ?`,
        [parsedParams.data.venueId]
      );
    } else {
      await pool.query(
        `update venues
         set establishment_link_status = 'rejected',
             establishment_link_approved_at = null,
             establishment_id = null
         where id = ?`,
        [parsedParams.data.venueId]
      );
    }

    const [rows] = await pool.query(
      `select
        venues.id,
        venues.name,
        venues.city,
        venues.address,
        venues.lat,
        venues.lng,
        venues.partner_status as partnerStatus,
        venues.category,
        venues.establishment_link_status as establishmentLinkStatus,
        ${linkDetailsSelect},
        venues.establishment_link_requested_at as establishmentLinkRequestedAt,
        venues.establishment_link_approved_at as establishmentLinkApprovedAt,
        establishments.id as establishmentId,
        establishments.display_name as establishmentName,
        venues.created_at as createdAt
      from venues
      left join establishments on establishments.id = venues.establishment_id
      where venues.id = ?
      limit 1`,
      [parsedParams.data.venueId]
    );

    return res.json(rows[0] || null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar aprovacao de vinculo.' });
  }
}
