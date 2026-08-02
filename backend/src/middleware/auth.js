import crypto from 'crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { pool } from '../config/db.js';

const revokedCache = new Set();
let cacheLoaded = false;

async function ensureCacheLoaded() {
  if (cacheLoaded) return;
  try {
    const [rows] = await pool.query(
      'select jti from revoked_tokens where expires_at > now()'
    );
    for (const row of rows) {
      revokedCache.add(row.jti);
    }
  } catch {
    // ignore — cache will be empty, DB check still runs
  }
  cacheLoaded = true;
}

export async function isTokenRevoked(jti) {
  if (revokedCache.has(jti)) return true;
  try {
    const [rows] = await pool.query(
      'select 1 from revoked_tokens where jti = ? and expires_at > now() limit 1',
      [jti]
    );
    if (rows.length > 0) {
      revokedCache.add(jti);
      return true;
    }
  } catch {
    // if DB fails, assume not revoked to avoid locking users out
  }
  return false;
}

export async function revokeToken(jti, userId, expiresAt) {
  try {
    await pool.query(
      'insert ignore into revoked_tokens (jti, user_id, expires_at) values (?, ?, ?)',
      [jti, userId, expiresAt]
    );
    revokedCache.add(jti);
  } catch {
    // ignore
  }
}

export async function revokeAllUserTokens(userId) {
  try {
    await pool.query('update users set token_version = token_version + 1 where id = ?', [userId]);
    revokedCache.clear();
    cacheLoaded = false;
  } catch {
    // ignore
  }
}

export async function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ message: 'Token ausente.' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    await ensureCacheLoaded();
    if (payload.jti && await isTokenRevoked(payload.jti)) {
      return res.status(401).json({ message: 'Token revogado.' });
    }
    if (payload.tv !== undefined) {
      const [rows] = await pool.query('select token_version from users where id = ? limit 1', [payload.id]);
      if (rows.length > 0 && rows[0].token_version !== payload.tv) {
        return res.status(401).json({ message: 'Token revogado.' });
      }
    }
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalido.' });
  }
}

export function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso restrito a administradores.' });
  }

  return next();
}

export function establishmentRequired(req, res, next) {
  if (!req.user || req.user.role !== 'establishment') {
    return res.status(403).json({ message: 'Acesso restrito a estabelecimentos.' });
  }

  return next();
}

export async function signToken(user) {
  const resolvedPremiumStatus =
    user.premium_status !== undefined
      ? Boolean(user.premium_status)
      : user.premiumStatus !== undefined
        ? Boolean(user.premiumStatus)
        : false;

  let tokenVersion = user.token_version;
  if (tokenVersion === undefined) {
    try {
      const [rows] = await pool.query('select token_version from users where id = ? limit 1', [user.id]);
      tokenVersion = rows[0]?.token_version ?? 0;
    } catch {
      tokenVersion = 0;
    }
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      premiumStatus: resolvedPremiumStatus,
      role: user.role || 'user',
      jti: crypto.randomUUID(),
      tv: tokenVersion,
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  );
}
