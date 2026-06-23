import { z } from 'zod';

import { pool } from '../config/db.js';

const checkinSchema = z.object({
  venueId: z.number().int().positive(),
});

export async function getCurrentCheckin(req, res) {
  try {
    const [rows] = await pool.query(
      `select
        c.id,
        c.venue_id as venueId,
        c.checked_in_at as checkedInAt,
        v.name as venueName
      from checkins c
      join venues v on v.id = c.venue_id
      where c.user_id = ? and c.active = 1
      limit 1`,
      [req.user.id]
    );

    return res.json(rows[0] || null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar check-in atual.' });
  }
}

export async function checkin(req, res) {
  const parsed = checkinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      'update checkins set active = 0, checked_out_at = now() where user_id = ? and active = 1',
      [req.user.id]
    );

    const [insertResult] = await connection.query(
      'insert into checkins (user_id, venue_id, active, checked_in_at) values (?, ?, 1, now())',
      [req.user.id, parsed.data.venueId]
    );

    await connection.query('update profiles set venue_id = ? where user_id = ?', [parsed.data.venueId, req.user.id]);

    await connection.commit();
    return res.status(201).json({ id: insertResult.insertId, venueId: parsed.data.venueId });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Erro ao realizar check-in.' });
  } finally {
    connection.release();
  }
}

export async function checkout(req, res) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [activeRows] = await connection.query(
      'select venue_id from checkins where user_id = ? and active = 1 limit 1',
      [req.user.id]
    );

    if (!activeRows.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'Usuario nao possui check-in ativo.' });
    }

    const venueId = activeRows[0].venue_id;

    await connection.query(
      'update checkins set active = 0, checked_out_at = now() where user_id = ? and active = 1',
      [req.user.id]
    );

    await connection.query('update profiles set venue_id = null where user_id = ?', [req.user.id]);

    await connection.query(
      `update chats c
       join matches m on m.id = c.match_id
       set c.expires_at = least(c.expires_at, date_add(now(), interval 15 minute))
       where m.venue_id = ? and (m.user_1 = ? or m.user_2 = ?)`,
      [venueId, req.user.id, req.user.id]
    );

    await connection.commit();
    return res.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Erro ao realizar checkout.' });
  } finally {
    connection.release();
  }
}
