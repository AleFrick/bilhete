import { z } from 'zod';

import { pool } from '../config/db.js';

export async function getActiveTerms(req, res) {
  try {
    const [rows] = await pool.query(
      'select id, version, title, body, created_at as createdAt from lgpd_terms where is_active = 1 order by created_at desc limit 1'
    );

    if (rows.length === 0) {
      return res.json({ hasTerms: false });
    }

    return res.json({ hasTerms: true, terms: rows[0] });
  } catch (error) {
    console.error('[lgpd:getActiveTerms] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao buscar termos.' });
  }
}

export async function getTermsStatus(req, res) {
  try {
    const [termsRows] = await pool.query(
      'select id, version from lgpd_terms where is_active = 1 order by created_at desc limit 1'
    );

    if (termsRows.length === 0) {
      return res.json({ needsAcceptance: false });
    }

    const activeTerms = termsRows[0];

    const [acceptRows] = await pool.query(
      'select id from user_terms_acceptance where user_id = ? and terms_id = ? limit 1',
      [req.user.id, activeTerms.id]
    );

    return res.json({
      needsAcceptance: acceptRows.length === 0,
      termsVersion: activeTerms.version,
      termsId: activeTerms.id,
    });
  } catch (error) {
    console.error('[lgpd:getTermsStatus] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao verificar status dos termos.' });
  }
}

export async function acceptTerms(req, res) {
  try {
    const [termsRows] = await pool.query(
      'select id, version from lgpd_terms where is_active = 1 order by created_at desc limit 1'
    );

    if (termsRows.length === 0) {
      return res.status(400).json({ message: 'Nao ha termos ativos para aceitar.' });
    }

    const activeTerms = termsRows[0];

    const [existing] = await pool.query(
      'select id from user_terms_acceptance where user_id = ? and terms_id = ? limit 1',
      [req.user.id, activeTerms.id]
    );

    if (existing.length > 0) {
      return res.json({ message: 'Termos ja aceitos anteriormente.' });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    await pool.query(
      'insert into user_terms_acceptance (user_id, terms_id, terms_version, ip_address, user_agent) values (?, ?, ?, ?, ?)',
      [req.user.id, activeTerms.id, activeTerms.version, ipAddress, userAgent]
    );

    return res.json({ message: 'Termos aceitos com sucesso.' });
  } catch (error) {
    console.error('[lgpd:acceptTerms] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao registrar aceite dos termos.' });
  }
}

export async function getMyAcceptanceHistory(req, res) {
  try {
    const [rows] = await pool.query(
      `select uta.id, uta.terms_id as termsId, uta.terms_version as termsVersion, uta.accepted_at as acceptedAt,
              lt.title as termsTitle
       from user_terms_acceptance uta
       join lgpd_terms lt on lt.id = uta.terms_id
       where uta.user_id = ?
       order by uta.accepted_at desc`,
      [req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    console.error('[lgpd:history] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao buscar historico de aceite.' });
  }
}

const adminTermsSchema = z.object({
  version: z.string().min(1).max(20),
  title: z.string().min(2).max(200),
  body: z.string().min(10),
});

export async function adminCreateTerms(req, res) {
  const parsed = adminTermsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para termos.' });
  }

  try {
    await pool.query('update lgpd_terms set is_active = 0 where is_active = 1');

    const [result] = await pool.query(
      'insert into lgpd_terms (version, title, body, is_active) values (?, ?, ?, 1)',
      [parsed.data.version, parsed.data.title, parsed.data.body]
    );

    return res.status(201).json({ id: result.insertId, message: 'Termos criados e ativados.' });
  } catch (error) {
    console.error('[lgpd:admin:create] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao criar termos.' });
  }
}

export async function adminListTerms(req, res) {
  try {
    const [rows] = await pool.query(
      'select id, version, title, is_active as isActive, created_at as createdAt from lgpd_terms order by created_at desc'
    );

    return res.json(rows);
  } catch (error) {
    console.error('[lgpd:admin:list] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao listar termos.' });
  }
}
