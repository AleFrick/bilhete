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
       where email = ? and role in ('admin', 'establishment')
       limit 1`,
      [email]
    );

    const panelUser = rows[0];
    if (!panelUser) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const isBcryptHash =
      typeof panelUser.password_hash === 'string' && panelUser.password_hash.startsWith('$2');
    let validPassword = false;

    if (isBcryptHash) {
      validPassword = await bcrypt.compare(normalizedPassword, panelUser.password_hash);
      if (!validPassword && env.passwordClientHashEnabled && normalizedPassword !== password) {
        validPassword = await bcrypt.compare(password, panelUser.password_hash);
      }
    } else {
      validPassword =
        process.env.NODE_ENV !== 'production' &&
        (normalizedPassword === panelUser.password_hash || password === panelUser.password_hash);
    }

    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const token = signToken(panelUser);
    return res.json({
      token,
      user: {
        id: panelUser.id,
        name: panelUser.name,
        email: panelUser.email,
        role: panelUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao autenticar acesso ao painel.' });
  }
}
