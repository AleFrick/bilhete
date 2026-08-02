import { pool } from '../config/db.js';

export async function cleanupExpiredMatchesAndChats() {
  const result = {
    expiredChats: 0,
    expiredMatches: 0,
    deletedMessages: 0,
    ranAt: new Date().toISOString(),
  };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [chatRows] = await connection.query(
      `select c.id from chats c where c.expires_at <= now()`
    );
    const expiredChatIds = chatRows.map((r) => r.id);

    if (expiredChatIds.length > 0) {
      const [msgResult] = await connection.query(
        `delete from messages where chat_id in (${expiredChatIds.map(() => '?').join(',')})`,
        expiredChatIds
      );
      result.deletedMessages = msgResult.affectedRows || 0;

      const [chatResult] = await connection.query(
        `delete from chats where id in (${expiredChatIds.map(() => '?').join(',')})`,
        expiredChatIds
      );
      result.expiredChats = chatResult.affectedRows || 0;
    }

    const [matchRows] = await connection.query(
      `select m.id from matches m
       left join chats c on c.match_id = m.id
       where m.expires_at <= now() and c.id is null`
    );
    const expiredMatchIds = matchRows.map((r) => r.id);

    if (expiredMatchIds.length > 0) {
      const [matchResult] = await connection.query(
        `delete from matches where id in (${expiredMatchIds.map(() => '?').join(',')})`,
        expiredMatchIds
      );
      result.expiredMatches = matchResult.affectedRows || 0;
    }

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('[cleanup] expired matches/chats cleanup failed', error?.message || String(error));
    throw error;
  } finally {
    connection.release();
  }
}
