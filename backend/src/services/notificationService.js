import { pool } from '../config/db.js';

const clients = new Map();

export function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(': connected\n\n');

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  res.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
  });
}

export function removeClient(userId, res) {
  const set = clients.get(userId);
  if (set) {
    set.delete(res);
    if (set.size === 0) {
      clients.delete(userId);
    }
  }
}

function pushToClient(userId, payload) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      removeClient(userId, res);
    }
  }
}

export async function createNotification({ userId, type, title, body = null, data = null }) {
  const [insertResult] = await pool.query(
    `insert into notifications (user_id, type, title, body, data) values (?, ?, ?, ?, ?)`,
    [userId, type, title, body, data ? JSON.stringify(data) : null]
  );

  const notification = {
    id: insertResult.insertId,
    userId,
    type,
    title,
    body,
    data,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  pushToClient(userId, notification);
  return notification;
}
