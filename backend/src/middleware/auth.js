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

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      premiumStatus: Boolean(user.premium_status),
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  );
}
