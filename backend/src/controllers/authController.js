import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { signToken } from '../middleware/auth.js';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(3),
});

function resolveHashAlgorithm() {
  return env.passwordHashAlgorithm === 'sha256' ? 'sha256' : 'sha512';
}

function normalizeIncomingPassword(password) {
  if (!env.passwordClientHashEnabled) {
    return password;
  }

  const algorithm = resolveHashAlgorithm();
  const expectedLength = algorithm === 'sha256' ? 64 : 128;
  const value = String(password || '').trim();

  // Accept already-hashed values sent by the client to avoid double hashing.
  if (new RegExp(`^[a-f0-9]{${expectedLength}}$`, 'i').test(value)) {
    return value.toLowerCase();
  }

  return createHash(algorithm).update(`${value}:${env.passwordHashSecret}`).digest('hex');
}

export async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  const { name, email, password } = parsed.data;
  const normalizedPassword = normalizeIncomingPassword(password);

  try {
    const [existing] = await pool.query('select id from users where email = ? limit 1', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'Email ja cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, 10);

    const [userInsert] = await pool.query(
      'insert into users (name, email, password_hash) values (?, ?, ?)',
      [name, email, passwordHash]
    );

    await pool.query(
      'insert into profiles (user_id, name, status_social, premium_status) values (?, ?, ?, ?)',
      [userInsert.insertId, name, 'observando', 0]
    );

    const token = signToken({ id: userInsert.insertId, email, premium_status: 0, role: 'user' });
    return res.status(201).json({ token, user: { id: userInsert.insertId, name, email, role: 'user' } });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao registrar usuario.' });
  }
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  const { email, password } = parsed.data;
  const normalizedPassword = normalizeIncomingPassword(password);

  try {
    const [rows] = await pool.query(
      `select
        u.id,
        u.name,
        u.email,
        u.role,
        u.password_hash,
        case
          when p.premium_status = 1 and (p.premium_expires_at is null or p.premium_expires_at > current_timestamp)
            then 1
          else 0
        end as premiumStatus,
        p.premium_expires_at as premiumExpiresAt
      from users u
      left join profiles p on p.user_id = u.id
      where u.email = ?
      limit 1`,
      [email]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const isBcryptHash = typeof user.password_hash === 'string' && user.password_hash.startsWith('$2');
    let validPassword = false;

    if (isBcryptHash) {
      validPassword = await bcrypt.compare(normalizedPassword, user.password_hash);
      if (!validPassword && env.passwordClientHashEnabled && normalizedPassword !== password) {
        validPassword = await bcrypt.compare(password, user.password_hash);
      }
    } else {
      validPassword =
        process.env.NODE_ENV !== 'production' &&
        (normalizedPassword === user.password_hash || password === user.password_hash);
    }

    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        premiumStatus: Boolean(user.premiumStatus),
        premiumExpiresAt: user.premiumExpiresAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao autenticar.' });
  }
}

export async function loginGoogle(req, res) {
  return res.status(501).json({ message: 'Login Google ainda nao implementado.' });
}

export async function loginApple(req, res) {
  return res.status(501).json({ message: 'Login Apple ainda nao implementado.' });
}
