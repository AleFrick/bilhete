import { z } from 'zod';

import { addVenueClient } from '../services/presenceService.js';
import { pool } from '../config/db.js';

const venueParamSchema = z.object({
  venueId: z.coerce.number().int().positive(),
});

export async function presenceStream(req, res) {
  const parsed = venueParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ message: 'venueId invalido.' });
  }

  const venueId = parsed.data.venueId;

  try {
    const [requesterCheckin] = await pool.query(
      `select id from checkins
       where user_id = ? and venue_id = ? and active = 1
       limit 1`,
      [req.user.id, venueId]
    );

    if (!requesterCheckin.length) {
      return res.status(403).json({ message: 'Sem permissao para ver este local.' });
    }
  } catch {
    return res.status(500).json({ message: 'Erro ao verificar check-in.' });
  }

  addVenueClient(venueId, res);
}
