import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { revokeAllUserTokens } from '../middleware/auth.js';
import { validateImageDataUrls } from '../middleware/imageValidation.js';
import { sendEmailChangeVerification } from '../services/emailService.js';

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).optional(),
  age: z.coerce.number().int().min(18).max(99).optional(),
  bio: z.string().max(280).optional(),
  photoUrls: z.array(z.string().min(1)).max(8).optional(),
  statusSocial: z.enum(['conversar', 'flertar', 'amizade', 'networking', 'observando']).optional(),
});

export async function getMe(req, res) {
  try {
    const [rows] = await pool.query(
      `select
        u.id,
        u.email,
        u.role,
        p.name,
        p.age,
        p.bio,
        p.photo_urls as photoUrls,
        p.status_social as statusSocial,
        case
          when exists (
            select 1 from premium_subscriptions ps
            where ps.user_id = u.id
              and ps.status = 'active'
              and ps.ends_at > current_timestamp
          ) then 1
          else 0
        end as premiumStatus,
        p.premium_expires_at as premiumExpiresAt,
        p.venue_id as venueId
      from users u
      join profiles p on p.user_id = u.id
      where u.id = ?
      limit 1`,
      [req.user.id]
    );

    const profile = rows[0] || null;
    if (!profile) {
      return res.json(null);
    }

    if (typeof profile.photoUrls === 'string') {
      try {
        profile.photoUrls = JSON.parse(profile.photoUrls);
      } catch (error) {
        profile.photoUrls = [];
      }
    }

    if (!Array.isArray(profile.photoUrls)) {
      profile.photoUrls = [];
    }

    return res.json(profile);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar perfil.' });
  }
}

export async function updateMe(req, res) {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  const updates = [];
  const values = [];

  if (parsed.data.name !== undefined) {
    updates.push('name = ?');
    values.push(parsed.data.name);
  }

  if (parsed.data.age !== undefined) {
    updates.push('age = ?');
    values.push(parsed.data.age);
  }

  if (parsed.data.bio !== undefined) {
    updates.push('bio = ?');
    values.push(parsed.data.bio);
  }

  if (parsed.data.photoUrls !== undefined) {
    const imageCheck = validateImageDataUrls(parsed.data.photoUrls, { maxBytes: 5 * 1024 * 1024 });
    if (!imageCheck.valid) {
      return res.status(400).json({ message: imageCheck.error });
    }
    updates.push('photo_urls = ?');
    values.push(JSON.stringify(parsed.data.photoUrls));
  }

  if (parsed.data.statusSocial !== undefined) {
    updates.push('status_social = ?');
    values.push(parsed.data.statusSocial);
  }

  if (!updates.length) {
    return res.status(400).json({ message: 'Nada para atualizar.' });
  }

  values.push(req.user.id);

  try {
    await pool.query(
      `insert into profiles (user_id, name, status_social, premium_status)
       select id, name, 'observando', 0
       from users
       where id = ?
       on duplicate key update user_id = user_id`,
      [req.user.id]
    );

    await pool.query(`update profiles set ${updates.join(', ')} where user_id = ?`, values);
    return getMe(req, res);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar perfil.' });
  }
}

const emailChangeSchema = z.object({
  newEmail: z.string().email(),
});

export async function requestEmailChange(req, res) {
  const parsed = emailChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'E-mail invalido.' });
  }

  const newEmail = parsed.data.newEmail.trim().toLowerCase();

  if (newEmail === req.user.email) {
    return res.status(400).json({ message: 'O novo e-mail e igual ao atual.' });
  }

  try {
    const [existing] = await pool.query(
      'select id from users where email = ? and id != ? limit 1',
      [newEmail, req.user.id]
    );
    if (existing.length) {
      return res.status(409).json({ message: 'Este e-mail ja esta em uso.' });
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + env.emailVerificationTtlHours * 60 * 60 * 1000);

    await pool.query(
      `update users
       set pending_email = ?,
           pending_email_token_hash = ?,
           pending_email_expires_at = ?
       where id = ?`,
      [newEmail, tokenHash, expiresAt, req.user.id]
    );

    const [profileRows] = await pool.query(
      'select p.name from profiles p where p.user_id = ? limit 1',
      [req.user.id]
    );
    const name = profileRows[0]?.name || 'Usuario';

    const verificationLink = `${env.emailVerificationBaseUrl}/api/me/email/verify?token=${token}`;

    await sendEmailChangeVerification({
      to: newEmail,
      name,
      verificationLink,
    });

    return res.json({ message: 'Enviamos um e-mail de confirmacao para o novo endereco. Acesse o link para concluir a troca.' });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao solicitar troca de e-mail.' });
  }
}

export async function confirmEmailChange(req, res) {
  const token = req.query.token;
  if (!token || typeof token !== 'string') {
    return res.status(400).send('Link de confirmacao invalido.');
  }

  const tokenHash = createHash('sha256').update(String(token)).digest('hex');

  try {
    const [rows] = await pool.query(
      `select id, pending_email, pending_email_expires_at
       from users
       where pending_email_token_hash = ?
       limit 1`,
      [tokenHash]
    );

    const user = rows[0];
    if (!user) {
      return res.status(400).send('Link de confirmacao invalido ou expirado.');
    }

    const expiresAt = user.pending_email_expires_at ? new Date(user.pending_email_expires_at) : null;
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      return res.status(400).send('Link de confirmacao expirado. Solicite a troca de e-mail novamente.');
    }

    await pool.query(
      `update users
       set email = ?,
           pending_email = null,
           pending_email_token_hash = null,
           pending_email_expires_at = null,
           token_version = token_version + 1
       where id = ?`,
      [user.pending_email, user.id]
    );

    return res.send('E-mail atualizado com sucesso! Voce pode fechar esta pagina e fazer login com o novo e-mail.');
  } catch (error) {
    return res.status(500).send('Erro ao confirmar troca de e-mail.');
  }
}

const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export async function deleteAccount(req, res) {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Senha obrigatoria.' });
  }

  try {
    const [rows] = await pool.query(
      'select password_hash from users where id = ? limit 1',
      [req.user.id]
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    const { default: bcrypt } = await import('bcryptjs');
    const validPassword = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Senha incorreta.' });
    }

    await pool.query('delete from user_terms_acceptance where user_id = ?', [req.user.id]);
    await pool.query('delete from notifications where user_id = ?', [req.user.id]);
    await pool.query('delete from revoked_tokens where user_id = ?', [req.user.id]);
    await pool.query('delete from refresh_tokens where user_id = ?', [req.user.id]);
    await pool.query('delete from profiles where user_id = ?', [req.user.id]);
    await pool.query('delete from checkins where user_id = ?', [req.user.id]);
    await pool.query('delete from bilhetes where from_user = ? or to_user = ?', [req.user.id, req.user.id]);
    await pool.query('delete from users where id = ?', [req.user.id]);

    return res.json({ message: 'Conta excluida com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir conta.' });
  }
}
