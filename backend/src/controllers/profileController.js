import { z } from 'zod';

import { pool } from '../config/db.js';

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
          when p.premium_status = 1 and (p.premium_expires_at is null or p.premium_expires_at > current_timestamp)
            then 1
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
