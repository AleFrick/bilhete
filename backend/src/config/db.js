import mysql from 'mysql2/promise';
import { env } from './env.js';

const rawPool = mysql.createPool({
  host: env.mysqlHost,
  port: env.mysqlPort,
  user: env.mysqlUser,
  password: env.mysqlPassword,
  database: env.mysqlDatabase,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

function compactSql(sql) {
  return String(sql || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

async function timedQuery(methodName, args) {
  const startedAt = Date.now();

  try {
    const result = await rawPool[methodName](...args);
    const elapsed = Date.now() - startedAt;

    if (env.sqlLoggingEnabled && elapsed >= env.slowQueryMs) {
      console.log(`[sql:slow] ${elapsed}ms ${compactSql(args[0])}`);
    }

    return result;
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    console.error(
      `[sql:error] ${elapsed}ms code=${error?.code || 'unknown'} message=${error?.message || 'unknown'}`
    );
    throw error;
  }
}

export const pool = {
  query: (...args) => timedQuery('query', args),
  execute: (...args) => timedQuery('execute', args),
  getConnection: (...args) => rawPool.getConnection(...args),
  end: (...args) => rawPool.end(...args),
};
