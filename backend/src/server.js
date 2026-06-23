import cors from 'cors';
import express from 'express';

import { pool } from './config/db.js';
import { env } from './config/env.js';
import routes from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit }));

app.use((req, res, next) => {
  if (!env.requestLoggingEnabled) {
    next();
    return;
  }

  const requestId = Math.random().toString(36).slice(2, 10);
  const startedAt = Date.now();
  const startedIso = new Date().toISOString();

  res.on('finish', () => {
    const elapsed = Date.now() - startedAt;
    const tag = elapsed >= env.slowRequestMs ? 'http:slow' : 'http';
    console.log(
      `[${tag}] id=${requestId} ${startedIso} ${req.method} ${req.originalUrl} status=${res.statusCode} ${elapsed}ms`
    );
  });

  next();
});

app.use('/api', routes);

app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') {
    console.warn(
      `[http:payload-too-large] ${req.method} ${req.originalUrl} limit=${env.jsonBodyLimit}`
    );
    return res.status(413).json({ message: 'Payload muito grande para esta operacao.' });
  }

  return next(error);
});

app.get('/healthz', async (req, res) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true, db: 'mysql' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'db_unavailable' });
  }
});

app.listen(env.port, () => {
  // Keep startup log concise for local dev.
  console.log(`Bilhete backend running on http://localhost:${env.port}`);
});
