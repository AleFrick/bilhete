import { z } from 'zod';

import { pool } from '../config/db.js';

const registrationSchema = z.object({
  establishmentName: z.string().min(2).max(160),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).optional().or(z.literal('')),
  cnpj: z.string().max(20).optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
});

function mapRequestRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || '',
    establishmentName: row.establishment_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone || '',
    cnpj: row.cnpj || '',
    description: row.description || '',
    status: row.status,
    adminNote: row.admin_note || '',
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function submitRegistration(req, res) {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para cadastro de estabelecimento.' });
  }

  const { establishmentName, contactEmail, contactPhone, cnpj, description } = parsed.data;

  try {
    const [existing] = await pool.query(
      `select id, status from establishment_registration_requests
       where user_id = ? and status = 'pending' limit 1`,
      [req.user.id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Voce ja possui um pedido de cadastro pendente.' });
    }

    const [result] = await pool.query(
      `insert into establishment_registration_requests
        (user_id, establishment_name, contact_email, contact_phone, cnpj, description)
       values (?, ?, ?, ?, ?, ?)`,
      [req.user.id, establishmentName, contactEmail, contactPhone || null, cnpj || null, description || null]
    );

    return res.status(201).json({
      id: result.insertId,
      message: 'Pedido de cadastro enviado. Aguarde a aprovacao do administrador.',
    });
  } catch (error) {
    console.error('[registration:submit] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao enviar pedido de cadastro.' });
  }
}

export async function getMyRegistrationStatus(req, res) {
  try {
    const [rows] = await pool.query(
      `select r.*, u.name as user_name
       from establishment_registration_requests r
       join users u on u.id = r.user_id
       where r.user_id = ?
       order by r.created_at desc
       limit 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.json({ hasRequest: false });
    }

    return res.json({ hasRequest: true, request: mapRequestRow(rows[0]) });
  } catch (error) {
    console.error('[registration:myStatus] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao buscar status do pedido.' });
  }
}

export async function listRegistrationMessages(req, res) {
  const requestId = Number(req.params.requestId);
  if (!Number.isFinite(requestId)) {
    return res.status(400).json({ message: 'Pedido invalido.' });
  }

  try {
    const [reqRows] = await pool.query(
      'select user_id from establishment_registration_requests where id = ? limit 1',
      [requestId]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ message: 'Pedido nao encontrado.' });
    }

    const isOwner = reqRows[0].user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    const [messages] = await pool.query(
      `select id, sender_role as senderRole, message, created_at as createdAt
       from establishment_registration_request_messages
       where request_id = ?
       order by created_at asc`,
      [requestId]
    );

    return res.json(messages);
  } catch (error) {
    console.error('[registration:messages:list] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao buscar mensagens.' });
  }
}

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
});

export async function sendRegistrationMessage(req, res) {
  const requestId = Number(req.params.requestId);
  if (!Number.isFinite(requestId)) {
    return res.status(400).json({ message: 'Pedido invalido.' });
  }

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Mensagem invalida.' });
  }

  try {
    const [reqRows] = await pool.query(
      'select user_id, status from establishment_registration_requests where id = ? limit 1',
      [requestId]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ message: 'Pedido nao encontrado.' });
    }

    const isOwner = reqRows[0].user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    if (reqRows[0].status !== 'pending') {
      return res.status(400).json({ message: 'Este pedido ja foi finalizado.' });
    }

    const senderRole = isAdmin ? 'admin' : 'establishment';

    const [result] = await pool.query(
      `insert into establishment_registration_request_messages
        (request_id, sender_role, message)
       values (?, ?, ?)`,
      [requestId, senderRole, parsed.data.message]
    );

    return res.status(201).json({
      id: result.insertId,
      senderRole,
      message: parsed.data.message,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[registration:messages:send] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao enviar mensagem.' });
  }
}

const adminListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export async function listAdminRegistrationRequests(req, res) {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Filtro invalido.' });
  }

  try {
    const params = [];
    let where = '';

    if (parsed.data.status) {
      where = 'where r.status = ?';
      params.push(parsed.data.status);
    }

    const [rows] = await pool.query(
      `select r.*, u.name as user_name, u.email as user_email
       from establishment_registration_requests r
       join users u on u.id = r.user_id
       ${where}
       order by r.created_at desc`,
      params
    );

    return res.json(rows.map(mapRequestRow));
  } catch (error) {
    console.error('[registration:admin:list] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao listar pedidos de cadastro.' });
  }
}

const adminReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  adminNote: z.string().max(2000).optional().or(z.literal('')),
});

export async function reviewAdminRegistrationRequest(req, res) {
  const requestId = Number(req.params.requestId);
  if (!Number.isFinite(requestId)) {
    return res.status(400).json({ message: 'Pedido invalido.' });
  }

  const parsed = adminReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para revisao.' });
  }

  try {
    const [rows] = await pool.query(
      'select * from establishment_registration_requests where id = ? limit 1',
      [requestId]
    );

    const request = rows[0];
    if (!request) {
      return res.status(404).json({ message: 'Pedido nao encontrado.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Este pedido ja foi revisado.' });
    }

    await pool.query(
      `update establishment_registration_requests
       set status = ?, admin_note = ?, reviewed_at = current_timestamp, reviewed_by = ?
       where id = ?`,
      [parsed.data.status, parsed.data.adminNote || null, req.user.id, requestId]
    );

    if (parsed.data.status === 'approved') {
      await pool.query(
        `update users set role = 'establishment', is_active = 1 where id = ?`,
        [request.user_id]
      );

      await pool.query(
        `insert into establishments (user_id, display_name, description)
         values (?, ?, ?)
         on duplicate key update display_name = values(display_name), description = values(description)`,
        [request.user_id, request.establishment_name, request.description || null]
      );
    }

    return res.json({ message: `Pedido ${parsed.data.status === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso.` });
  } catch (error) {
    console.error('[registration:admin:review] failed', error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao revisar pedido.' });
  }
}
