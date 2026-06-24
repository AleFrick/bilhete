import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ message: 'Token ausente.' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
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

export function signToken(user) {
  const resolvedPremiumStatus =
    user.premium_status !== undefined
      ? Boolean(user.premium_status)
      : user.premiumStatus !== undefined
        ? Boolean(user.premiumStatus)
        : false;

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      premiumStatus: resolvedPremiumStatus,
      role: user.role || 'user',
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  );
}
