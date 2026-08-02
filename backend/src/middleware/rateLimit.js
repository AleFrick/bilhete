function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter({ windowMs, max, message }) {
  const buckets = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now - entry.firstRequestAt > windowMs) {
        buckets.delete(key);
      }
    }
  }, windowMs).unref();

  return function rateLimiter(req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = buckets.get(ip);

    if (!entry || now - entry.firstRequestAt > windowMs) {
      buckets.set(ip, { firstRequestAt: now, count: 1 });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.firstRequestAt + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        message: message || 'Muitas requisicoes. Tente novamente em alguns instantes.',
        retryAfter: retryAfterSec,
      });
    }

    return next();
  };
}
