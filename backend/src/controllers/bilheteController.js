import { z } from 'zod';

import { pool } from '../config/db.js';

const createBilheteSchema = z.object({
  toUserId: z.number().int().positive(),
  venueId: z.number().int().positive(),
  type: z.enum(['curtida', 'emoji', 'troquei_olhares', 'mensagem_livre']),
  message: z.string().max(300).optional(),
});

const respondSchema = z.object({
  action: z.enum(['respondido', 'ignorado']),
});

export async function sendBilhete(req, res) {
  const parsed = createBilheteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  if (parsed.data.toUserId === req.user.id) {
    return res.status(400).json({ message: 'Nao e possivel enviar bilhete para si mesmo.' });
  }

  try {
    const [checkins] = await pool.query(
      `select user_id from checkins
       where venue_id = ? and active = 1 and user_id in (?, ?)`,
      [parsed.data.venueId, req.user.id, parsed.data.toUserId]
    );

    if (checkins.length < 2) {
      return res.status(400).json({ message: 'Ambos usuarios precisam estar no mesmo local ativo.' });
    }

    const [insertResult] = await pool.query(
      `insert into bilhetes
       (from_user, to_user, venue_id, type, message, status, created_at)
       values (?, ?, ?, ?, ?, 'enviado', now())`,
      [req.user.id, parsed.data.toUserId, parsed.data.venueId, parsed.data.type, parsed.data.message || null]
    );

    return res.status(201).json({ id: insertResult.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao enviar bilhete.' });
  }
}

export async function inbox(req, res) {
  try {
    const [rows] = await pool.query(
      `select
        b.id,
        b.from_user as fromUser,
        p.name as fromName,
        b.venue_id as venueId,
        v.name as venueName,
        b.type,
        b.message,
        b.status,
        b.created_at as createdAt
      from bilhetes b
      join profiles p on p.user_id = b.from_user
      join venues v on v.id = b.venue_id
      where b.to_user = ?
      order by b.created_at desc`,
      [req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar inbox.' });
  }
}

export async function outbox(req, res) {
  try {
    const [rows] = await pool.query(
      `select
        b.id,
        b.to_user as toUser,
        p.name as toName,
        b.venue_id as venueId,
        v.name as venueName,
        b.type,
        b.message,
        b.status,
        b.created_at as createdAt
      from bilhetes b
      join profiles p on p.user_id = b.to_user
      join venues v on v.id = b.venue_id
      where b.from_user = ?
      order by b.created_at desc`,
      [req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar outbox.' });
  }
}

export async function respond(req, res) {
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  const bilheteId = Number(req.params.id);
  if (!Number.isFinite(bilheteId)) {
    return res.status(400).json({ message: 'id invalido.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `select id, from_user, to_user, venue_id, status
       from bilhetes
       where id = ? and to_user = ?
       limit 1`,
      [bilheteId, req.user.id]
    );

    const bilhete = rows[0];
    if (!bilhete) {
      await connection.rollback();
      return res.status(404).json({ message: 'Bilhete nao encontrado.' });
    }

    if (bilhete.status !== 'enviado') {
      await connection.rollback();
      return res.status(400).json({ message: 'Bilhete ja processado.' });
    }

    await connection.query('update bilhetes set status = ? where id = ?', [parsed.data.action, bilheteId]);

    if (parsed.data.action === 'respondido') {
      const userA = Math.min(bilhete.from_user, bilhete.to_user);
      const userB = Math.max(bilhete.from_user, bilhete.to_user);

      const [existingMatchRows] = await connection.query(
        `select id from matches
         where user_1 = ? and user_2 = ? and venue_id = ?
         limit 1`,
        [userA, userB, bilhete.venue_id]
      );

      let matchId = existingMatchRows[0]?.id;

      if (!matchId) {
        const [matchInsert] = await connection.query(
          `insert into matches (user_1, user_2, venue_id, created_at, expires_at)
           values (?, ?, ?, now(), date_add(now(), interval 12 hour))`,
          [userA, userB, bilhete.venue_id]
        );

        matchId = matchInsert.insertId;
      }

      const [existingChatRows] = await connection.query(
        'select id from chats where match_id = ? limit 1',
        [matchId]
      );

      if (!existingChatRows.length) {
        await connection.query(
          `insert into chats (match_id, expires_at, created_at)
           values (?, date_add(now(), interval 12 hour), now())`,
          [matchId]
        );
      }
    }

    await connection.commit();
    return res.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: 'Erro ao responder bilhete.' });
  } finally {
    connection.release();
  }
}
