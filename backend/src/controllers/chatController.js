import { z } from 'zod';

import { pool } from '../config/db.js';
import { createNotification } from '../services/notificationService.js';

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
});

export async function listMatches(req, res) {
  try {
    const [rows] = await pool.query(
      `select
        m.id,
        m.user_1 as user1,
        m.user_2 as user2,
        m.venue_id as venueId,
        v.name as venueName,
        m.expires_at as expiresAt
      from matches m
      join venues v on v.id = m.venue_id
      where (m.user_1 = ? or m.user_2 = ?) and m.expires_at > now()
      order by m.created_at desc`,
      [req.user.id, req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar matches.' });
  }
}

export async function listChats(req, res) {
  try {
    const [rows] = await pool.query(
      `select
        c.id,
        c.match_id as matchId,
        c.expires_at as expiresAt,
        m.venue_id as venueId,
        v.name as venueName,
        m.user_1 as user1,
        m.user_2 as user2,
        case
          when m.user_1 = ? then m.user_2
          else m.user_1
        end as otherUserId,
        case
          when m.user_1 = ? then p2.name
          else p1.name
        end as otherUserName,
        case
          when m.user_1 = ? then p2.photo_urls
          else p1.photo_urls
        end as otherUserPhotos
      from chats c
      join matches m on m.id = c.match_id
      join venues v on v.id = m.venue_id
      left join profiles p1 on p1.user_id = m.user_1
      left join profiles p2 on p2.user_id = m.user_2
      where (m.user_1 = ? or m.user_2 = ?) and c.expires_at > now()
      order by c.created_at desc`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar chats.' });
  }
}

export async function getMessages(req, res) {
  const chatId = Number(req.params.chatId);
  if (!Number.isFinite(chatId)) {
    return res.status(400).json({ message: 'chatId invalido.' });
  }

  try {
    const [chatRows] = await pool.query(
      `select c.id, c.expires_at
       from chats c
       join matches m on m.id = c.match_id
       where c.id = ? and (m.user_1 = ? or m.user_2 = ?)
       limit 1`,
      [chatId, req.user.id, req.user.id]
    );

    if (!chatRows.length) {
      return res.status(404).json({ message: 'Chat nao encontrado.' });
    }

    if (new Date(chatRows[0].expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Chat expirado.' });
    }

    const [rows] = await pool.query(
      `select
        id,
        sender_id as senderId,
        message,
        created_at as createdAt
      from messages
      where chat_id = ?
      order by created_at asc`,
      [chatId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar mensagens.' });
  }
}

export async function sendMessage(req, res) {
  const chatId = Number(req.params.chatId);
  if (!Number.isFinite(chatId)) {
    return res.status(400).json({ message: 'chatId invalido.' });
  }

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Mensagem invalida.' });
  }

  try {
    const [chatRows] = await pool.query(
      `select
         c.id,
         c.expires_at,
         m.user_1,
         m.user_2
       from chats c
       join matches m on m.id = c.match_id
       where c.id = ? and (m.user_1 = ? or m.user_2 = ?)
       limit 1`,
      [chatId, req.user.id, req.user.id]
    );

    const chat = chatRows[0];
    if (!chat) {
      return res.status(404).json({ message: 'Chat nao encontrado.' });
    }

    if (new Date(chat.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Chat expirado.' });
    }

    const [insertResult] = await pool.query(
      `insert into messages (chat_id, sender_id, message, created_at)
       values (?, ?, ?, now())`,
      [chatId, req.user.id, parsed.data.message]
    );

    const otherUserId = chat.user_1 === req.user.id ? chat.user_2 : chat.user_1;

    if (otherUserId !== req.user.id) {
      const [senderRows] = await pool.query(
        'select p.name from profiles p where p.user_id = ? limit 1',
        [req.user.id]
      );
      const senderName = senderRows[0]?.name || 'Alguem';

      await createNotification({
        userId: otherUserId,
        type: 'chat',
        title: 'Nova mensagem',
        body: `${senderName}: ${parsed.data.message.slice(0, 80)}`,
        data: { chatId },
      });
    }

    return res.status(201).json({ id: insertResult.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao enviar mensagem.' });
  }
}
