import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { addClient } from '../services/notificationService.js';

export function notificationStream(req, res) {
  addClient(req.user.id, res);
}

export async function listNotifications(req, res) {
  try {
    const [rows] = await pool.query(
      `select
        id,
        type,
        title,
        body,
        data,
        is_read as isRead,
        created_at as createdAt
      from notifications
      where user_id = ?
      order by created_at desc
      limit 50`,
      [req.user.id]
    );

    const [unreadRows] = await pool.query(
      'select count(*) as cnt from notifications where user_id = ? and is_read = 0',
      [req.user.id]
    );

    return res.json({ notifications: rows, unreadCount: unreadRows[0]?.cnt || 0 });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar notificacoes.' });
  }
}

export async function markNotificationsRead(req, res) {
  try {
    await pool.query(
      'update notifications set is_read = 1 where user_id = ? and is_read = 0',
      [req.user.id]
    );
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao marcar notificacoes.' });
  }
}
