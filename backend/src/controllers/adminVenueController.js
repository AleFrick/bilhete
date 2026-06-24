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

const adminVenuesQuerySchema = z.object({
  city: z.string().trim().min(2).max(120).optional(),
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
});

export async function listAdminVenues(req, res) {
  const parsedQuery = adminVenuesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Filtros invalidos.' });
  }

  const { city, q, category } = parsedQuery.data;

  try {
    const where = [];
    const values = [];

    if (city) {
      where.push('lower(city) = lower(?)');
      values.push(city);
    }

    if (category) {
      where.push('lower(coalesce(category, "")) = lower(?)');
      values.push(category);
    }

    if (q) {
      where.push('concat_ws(" ", name, city, coalesce(address, ""), coalesce(category, ""), if(partner_status = 1, "parceiro", "")) like ?');
      values.push(`%${q}%`);
    }

    const whereSql = where.length ? `where ${where.join(' and ')}` : '';

    const [rows] = await pool.query(
      `select
        id,
        name,
        city,
        address,
        lat,
        lng,
        partner_status as partnerStatus,
        category,
        created_at as createdAt
      from venues
      ${whereSql}
      order by created_at desc`
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

export async function createAdminVenue(req, res) {
  const parsed = createVenueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para cadastro de local.' });
  }

  const payload = parsed.data;

  try {
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
        id,
        name,
        city,
        address,
        lat,
        lng,
        partner_status as partnerStatus,
        category,
        created_at as createdAt
      from venues
      where id = ?
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
        id,
        name,
        city,
        address,
        lat,
        lng,
        partner_status as partnerStatus,
        category,
        created_at as createdAt
      from venues
      where id = ?
      limit 1`,
      [parsedParams.data.venueId]
    );

    return res.json(rows[0] || null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar local.' });
  }
}
