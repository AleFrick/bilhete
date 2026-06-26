import { z } from 'zod';

import { pool } from '../config/db.js';

const MAX_TICKET_ATTACHMENTS = 6;

const attachmentValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_000_000)
  .refine((value) => /^https?:\/\//i.test(value) || /^data:image\//i.test(value), {
    message: 'Anexo de imagem invalido.',
  });

const supportTicketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
  attachments: z.array(attachmentValueSchema).max(MAX_TICKET_ATTACHMENTS).optional(),
});

const supportTicketListQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
});

const supportTicketUpdateParamsSchema = z.object({
  ticketId: z.coerce.number().int().positive(),
});

const supportTicketUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
  adminResponse: z.string().trim().max(4000).optional().or(z.literal('')),
});

const supportTicketMessageParamsSchema = z.object({
  ticketId: z.coerce.number().int().positive(),
});

const supportTicketMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

let supportTicketAttachmentColumnExists;

async function hasSupportTicketAttachmentColumn() {
  if (supportTicketAttachmentColumnExists !== undefined) {
    return supportTicketAttachmentColumnExists;
  }

  try {
    const [rows] = await pool.query(
      "show columns from establishment_support_tickets like 'attachment_urls'"
    );
    supportTicketAttachmentColumnExists = Array.isArray(rows) && rows.length > 0;
  } catch {
    supportTicketAttachmentColumnExists = false;
  }

  return supportTicketAttachmentColumnExists;
}

function attachmentSelectFragment(hasAttachmentColumn) {
  return hasAttachmentColumn ? 't.attachment_urls as attachmentUrls' : "'[]' as attachmentUrls";
}

async function getEstablishmentIdForUser(userId) {
  const [rows] = await pool.query(
    'select id from establishments where user_id = ? limit 1',
    [userId]
  );

  return rows[0]?.id || null;
}

async function getTicketForEstablishmentUser(userId, ticketId) {
  const [rows] = await pool.query(
    `select
      t.id,
      t.establishment_id as establishmentId,
      t.status
    from establishment_support_tickets t
    join establishments e on e.id = t.establishment_id
    where t.id = ? and e.user_id = ?
    limit 1`,
    [ticketId, userId]
  );

  return rows[0] || null;
}

async function getTicketById(ticketId) {
  const [rows] = await pool.query(
    `select
      id,
      establishment_id as establishmentId,
      status
    from establishment_support_tickets
    where id = ?
    limit 1`,
    [ticketId]
  );

  return rows[0] || null;
}

function normalizeTicketMessageRow(row) {
  return {
    id: row.id,
    ticketId: row.ticketId,
    senderRole: row.senderRole,
    message: row.message,
    createdAt: row.createdAt,
  };
}

async function listTicketMessages(ticketId) {
  const [rows] = await pool.query(
    `select
      id,
      ticket_id as ticketId,
      sender_role as senderRole,
      message,
      created_at as createdAt
    from establishment_support_ticket_messages
    where ticket_id = ?
    order by created_at asc, id asc`,
    [ticketId]
  );

  return rows.map(normalizeTicketMessageRow);
}

function normalizeTicketRow(row) {
  let attachmentUrls = [];
  if (Array.isArray(row?.attachmentUrls)) {
    attachmentUrls = row.attachmentUrls.filter((value) => typeof value === 'string' && value.trim());
  } else if (typeof row?.attachmentUrls === 'string' && row.attachmentUrls.trim()) {
    try {
      const parsed = JSON.parse(row.attachmentUrls);
      if (Array.isArray(parsed)) {
        attachmentUrls = parsed.filter((value) => typeof value === 'string' && value.trim());
      }
    } catch {
      attachmentUrls = [];
    }
  }

  return {
    ...row,
    attachmentUrls,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listEstablishmentSupportTickets(req, res) {
  const parsed = supportTicketListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Filtro de chamados invalido.' });
  }

  try {
    const hasAttachmentColumn = await hasSupportTicketAttachmentColumn();
    const establishmentId = await getEstablishmentIdForUser(req.user.id);
    if (!establishmentId) {
      return res.status(404).json({ message: 'Estabelecimento nao encontrado para esta conta.' });
    }

    const values = [establishmentId];
    let statusClause = '';
    if (parsed.data.status) {
      statusClause = ' and t.status = ?';
      values.push(parsed.data.status);
    }

    const [rows] = await pool.query(
      `select
        t.id,
        t.subject,
        t.message,
        ${attachmentSelectFragment(hasAttachmentColumn)},
        t.status,
        t.admin_response as adminResponse,
        t.created_at as createdAt,
        t.updated_at as updatedAt
      from establishment_support_tickets t
      where t.establishment_id = ?${statusClause}
      order by
        case t.status
          when 'open' then 0
          when 'in_progress' then 1
          else 2
        end,
        t.created_at desc`,
      values
    );

    return res.json(rows.map(normalizeTicketRow));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar chamados do estabelecimento.' });
  }
}

export async function createEstablishmentSupportTicket(req, res) {
  const parsed = supportTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para abrir chamado.' });
  }

  try {
    const hasAttachmentColumn = await hasSupportTicketAttachmentColumn();
    const establishmentId = await getEstablishmentIdForUser(req.user.id);
    if (!establishmentId) {
      return res.status(404).json({ message: 'Estabelecimento nao encontrado para esta conta.' });
    }

    const [result] = hasAttachmentColumn
      ? await pool.query(
          `insert into establishment_support_tickets (
            establishment_id,
            subject,
            message,
            attachment_urls,
            status
          ) values (?, ?, ?, ?, 'open')`,
          [
            establishmentId,
            parsed.data.subject,
            parsed.data.message,
            JSON.stringify(parsed.data.attachments || []),
          ]
        )
      : await pool.query(
          `insert into establishment_support_tickets (
            establishment_id,
            subject,
            message,
            status
          ) values (?, ?, ?, 'open')`,
          [establishmentId, parsed.data.subject, parsed.data.message]
        );

    const [rows] = await pool.query(
      `select
        t.id,
        t.subject,
        t.message,
        ${attachmentSelectFragment(hasAttachmentColumn)},
        t.status,
        t.admin_response as adminResponse,
        t.created_at as createdAt,
        t.updated_at as updatedAt
      from establishment_support_tickets t
      where t.id = ?
      limit 1`,
      [result.insertId]
    );

    return res.status(201).json(normalizeTicketRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao abrir chamado.' });
  }
}

export async function listAdminSupportTickets(req, res) {
  const parsed = supportTicketListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Filtro de chamados invalido.' });
  }

  try {
    const hasAttachmentColumn = await hasSupportTicketAttachmentColumn();
    const values = [];
    let statusClause = '';
    if (parsed.data.status) {
      statusClause = 'where t.status = ?';
      values.push(parsed.data.status);
    }

    const [rows] = await pool.query(
      `select
        t.id,
        t.subject,
        t.message,
        ${attachmentSelectFragment(hasAttachmentColumn)},
        t.status,
        t.admin_response as adminResponse,
        t.created_at as createdAt,
        t.updated_at as updatedAt,
        e.id as establishmentId,
        e.display_name as establishmentName,
        e.contact_email as establishmentEmail,
        u.email as ownerEmail
      from establishment_support_tickets t
      join establishments e on e.id = t.establishment_id
      join users u on u.id = e.user_id
      ${statusClause}
      order by
        case t.status
          when 'open' then 0
          when 'in_progress' then 1
          else 2
        end,
        t.created_at desc`,
      values
    );

    return res.json(rows.map(normalizeTicketRow));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar chamados para o admin.' });
  }
}

export async function updateAdminSupportTicket(req, res) {
  const parsedParams = supportTicketUpdateParamsSchema.safeParse(req.params);
  const parsedBody = supportTicketUpdateSchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    return res.status(400).json({ message: 'Dados invalidos para atualizar chamado.' });
  }

  const updates = [];
  const values = [];

  if (parsedBody.data.status !== undefined) {
    updates.push('status = ?');
    values.push(parsedBody.data.status);
  }

  if (parsedBody.data.adminResponse !== undefined) {
    updates.push('admin_response = ?');
    values.push(parsedBody.data.adminResponse || null);
  }

  if (!updates.length) {
    return res.status(400).json({ message: 'Nada para atualizar no chamado.' });
  }

  values.push(parsedParams.data.ticketId);

  try {
    const hasAttachmentColumn = await hasSupportTicketAttachmentColumn();
    await pool.query(
      `update establishment_support_tickets
       set ${updates.join(', ')}
       where id = ?`,
      values
    );

    const [rows] = await pool.query(
      `select
        t.id,
        t.subject,
        t.message,
        ${attachmentSelectFragment(hasAttachmentColumn)},
        t.status,
        t.admin_response as adminResponse,
        t.created_at as createdAt,
        t.updated_at as updatedAt,
        e.id as establishmentId,
        e.display_name as establishmentName,
        e.contact_email as establishmentEmail,
        u.email as ownerEmail
      from establishment_support_tickets t
      join establishments e on e.id = t.establishment_id
      join users u on u.id = e.user_id
      where t.id = ?
      limit 1`,
      [parsedParams.data.ticketId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Chamado nao encontrado.' });
    }

    return res.json(normalizeTicketRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar chamado.' });
  }
}

export async function listEstablishmentSupportTicketMessages(req, res) {
  const parsedParams = supportTicketMessageParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Chamado invalido.' });
  }

  try {
    const ticket = await getTicketForEstablishmentUser(req.user.id, parsedParams.data.ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Chamado nao encontrado.' });
    }

    const messages = await listTicketMessages(parsedParams.data.ticketId);
    return res.json(messages);
  } catch {
    return res.status(500).json({ message: 'Erro ao carregar mensagens do chamado.' });
  }
}

export async function createEstablishmentSupportTicketMessage(req, res) {
  const parsedParams = supportTicketMessageParamsSchema.safeParse(req.params);
  const parsedBody = supportTicketMessageSchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    return res.status(400).json({ message: 'Dados invalidos para enviar mensagem.' });
  }

  try {
    const ticket = await getTicketForEstablishmentUser(req.user.id, parsedParams.data.ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Chamado nao encontrado.' });
    }

    if (ticket.status === 'resolved') {
      return res.status(409).json({ message: 'Este chamado esta encerrado e nao aceita novas mensagens.' });
    }

    const [result] = await pool.query(
      `insert into establishment_support_ticket_messages (
        ticket_id,
        sender_role,
        message
      ) values (?, 'establishment', ?)`,
      [parsedParams.data.ticketId, parsedBody.data.message]
    );

    const [rows] = await pool.query(
      `select
        id,
        ticket_id as ticketId,
        sender_role as senderRole,
        message,
        created_at as createdAt
      from establishment_support_ticket_messages
      where id = ?
      limit 1`,
      [result.insertId]
    );

    return res.status(201).json(normalizeTicketMessageRow(rows[0]));
  } catch {
    return res.status(500).json({ message: 'Erro ao enviar mensagem no chamado.' });
  }
}

export async function listAdminSupportTicketMessages(req, res) {
  const parsedParams = supportTicketMessageParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Chamado invalido.' });
  }

  try {
    const ticket = await getTicketById(parsedParams.data.ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Chamado nao encontrado.' });
    }

    const messages = await listTicketMessages(parsedParams.data.ticketId);
    return res.json(messages);
  } catch {
    return res.status(500).json({ message: 'Erro ao carregar mensagens do chamado.' });
  }
}

export async function createAdminSupportTicketMessage(req, res) {
  const parsedParams = supportTicketMessageParamsSchema.safeParse(req.params);
  const parsedBody = supportTicketMessageSchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    return res.status(400).json({ message: 'Dados invalidos para enviar mensagem.' });
  }

  try {
    const ticket = await getTicketById(parsedParams.data.ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Chamado nao encontrado.' });
    }

    if (ticket.status === 'resolved') {
      return res.status(409).json({ message: 'Este chamado esta encerrado e nao aceita novas mensagens.' });
    }

    const [result] = await pool.query(
      `insert into establishment_support_ticket_messages (
        ticket_id,
        sender_role,
        message
      ) values (?, 'admin', ?)`,
      [parsedParams.data.ticketId, parsedBody.data.message]
    );

    const [rows] = await pool.query(
      `select
        id,
        ticket_id as ticketId,
        sender_role as senderRole,
        message,
        created_at as createdAt
      from establishment_support_ticket_messages
      where id = ?
      limit 1`,
      [result.insertId]
    );

    return res.status(201).json(normalizeTicketMessageRow(rows[0]));
  } catch {
    return res.status(500).json({ message: 'Erro ao enviar mensagem no chamado.' });
  }
}
