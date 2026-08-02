import { pool } from '../config/db.js';

const venueClients = new Map();

export function addVenueClient(venueId, res) {
  if (!venueClients.has(venueId)) {
    venueClients.set(venueId, new Set());
  }
  venueClients.get(venueId).add(res);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(': connected\n\n');

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  res.on('close', () => {
    clearInterval(heartbeat);
    removeVenueClient(venueId, res);
  });
}

export function removeVenueClient(venueId, res) {
  const set = venueClients.get(venueId);
  if (set) {
    set.delete(res);
    if (set.size === 0) {
      venueClients.delete(venueId);
    }
  }
}

function pushToVenue(venueId, event, payload) {
  const set = venueClients.get(venueId);
  if (!set || set.size === 0) return;
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      removeVenueClient(venueId, res);
    }
  }
}

export async function broadcastCheckin(venueId, userId) {
  try {
    const [rows] = await pool.query(
      `select
        p.user_id as id,
        p.name,
        p.age,
        p.photo_urls as photoUrls,
        p.status_social as statusSocial,
        case
          when exists (
            select 1 from premium_subscriptions ps
            where ps.user_id = p.user_id
              and ps.status = 'active'
              and ps.ends_at > current_timestamp
          ) then 1
          else 0
        end as premiumStatus,
        c.checked_in_at as checkedInAt
      from profiles p
      join checkins c on c.user_id = p.user_id
      where c.venue_id = ? and c.active = 1 and c.user_id = ?
      limit 1`,
      [venueId, userId]
    );

    if (!rows.length) return;

    const person = rows[0];
    let photoUrls = [];
    if (Array.isArray(person.photoUrls)) {
      photoUrls = person.photoUrls;
    } else if (typeof person.photoUrls === 'string') {
      try {
        photoUrls = JSON.parse(person.photoUrls);
      } catch {
        photoUrls = [];
      }
    }
    person.photoUrls = photoUrls;

    pushToVenue(venueId, 'checkin', person);
  } catch {
    // ignore
  }
}

export async function broadcastCheckout(venueId, userId) {
  pushToVenue(venueId, 'checkout', { id: userId });
}
