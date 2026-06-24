import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { signToken } from '../middleware/auth.js';

const adminLoginSchema = z.object({
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

  if (new RegExp(`^[a-f0-9]{${expectedLength}}$`, 'i').test(value)) {
    return value.toLowerCase();
  }

  return createHash(algorithm).update(`${value}:${env.passwordHashSecret}`).digest('hex');
}

export async function loginAdmin(req, res) {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  const { email, password } = parsed.data;
  const normalizedPassword = normalizeIncomingPassword(password);

  try {
    const [rows] = await pool.query(
      `select id, name, email, role, password_hash
       from users
       where email = ? and role = 'admin'
       limit 1`,
      [email]
    );

    const adminUser = rows[0];
    if (!adminUser) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const isBcryptHash =
      typeof adminUser.password_hash === 'string' && adminUser.password_hash.startsWith('$2');
    let validPassword = false;

    if (isBcryptHash) {
      validPassword = await bcrypt.compare(normalizedPassword, adminUser.password_hash);
      if (!validPassword && env.passwordClientHashEnabled && normalizedPassword !== password) {
        validPassword = await bcrypt.compare(password, adminUser.password_hash);
      }
    } else {
      validPassword =
        process.env.NODE_ENV !== 'production' &&
        (normalizedPassword === adminUser.password_hash || password === adminUser.password_hash);
    }

    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const token = signToken(adminUser);
    return res.json({
      token,
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao autenticar administrador.' });
  }
}
