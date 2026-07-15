import { randomBytes } from 'crypto';
import { z } from 'zod';

import { pool } from '../config/db.js';

const TARGET_GROUPS = ['user', 'establishment'];

const checkoutSchema = z.object({
  packageId: z.coerce.number().int().positive(),
  couponCode: z.string().trim().max(40).optional(),
});

const orderParamSchema = z.object({
  orderId: z.coerce.number().int().positive(),
});

const packageCreateSchema = z.object({
  targetGroup: z.enum(TARGET_GROUPS),
  promotionId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(700).optional().or(z.literal('')),
  priceCents: z.coerce.number().int().min(0),
  durationDays: z.coerce.number().int().min(1).max(3650),
  displayOrder: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const packageUpdateSchema = packageCreateSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: 'Nenhum campo informado para atualizar pacote.',
});

const packageParamSchema = z.object({
  packageId: z.coerce.number().int().positive(),
});

const couponCreateSchema = z.object({
  targetGroup: z.enum(TARGET_GROUPS),
  code: z.string().trim().min(3).max(40),
  description: z.string().trim().max(700).optional().or(z.literal('')),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.coerce.number().positive(),
  validFrom: z.string().trim().max(30).optional().or(z.literal('')),
  validUntil: z.string().trim().max(30).optional().or(z.literal('')),
  usageLimit: z.coerce.number().int().positive().optional(),
  active: z.boolean().optional(),
});

const couponUpdateSchema = couponCreateSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: 'Nenhum campo informado para atualizar cupom.',
});

const couponParamSchema = z.object({
  couponId: z.coerce.number().int().positive(),
});

const promotionCreateSchema = z.object({
  targetGroup: z.enum(TARGET_GROUPS),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(700).optional().or(z.literal('')),
  startsAt: z.string().trim().min(10).max(30),
  endsAt: z.string().trim().max(30).optional().or(z.literal('')),
});

const promotionUpdateSchema = promotionCreateSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Nenhum campo informado para atualizar promocao.',
  });

const promotionParamSchema = z.object({
  promotionId: z.coerce.number().int().positive(),
});

const adminListQuerySchema = z.object({
  targetGroup: z.enum(TARGET_GROUPS).optional(),
});

function resolveTargetGroup(role) {
  if (role === 'user' || role === 'establishment') {
    return role;
  }

  return null;
}

function normalizeDateTimeInput(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  const asSql = normalized.includes('T') ? `${normalized.replace('T', ' ')}:00` : normalized;
  const parsedDate = new Date(asSql);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return asSql.slice(0, 19);
}

function mapPackageRow(row) {
  return {
    id: row.id,
    targetGroup: row.targetGroup,
    promotionId: row.promotionId,
    title: row.title,
    description: row.description,
    priceCents: Number(row.priceCents || 0),
    durationDays: Number(row.durationDays || 0),
    displayOrder: Number(row.displayOrder || 0),
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCouponRow(row) {
  return {
    id: row.id,
    targetGroup: row.targetGroup,
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    discountValue: Number(row.discountValue || 0),
    usageLimit: row.usageLimit !== null && row.usageLimit !== undefined ? Number(row.usageLimit) : null,
    usedCount: Number(row.usedCount || 0),
    active: Boolean(row.active),
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPromotionRow(row) {
  return {
    id: row.id,
    targetGroup: row.targetGroup,
    name: row.name,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapOrderRow(row) {
  return {
    id: row.id,
    status: row.status,
    packageId: row.packageId,
    packageTitle: row.packageTitle,
    couponCode: row.couponCode,
    basePriceCents: Number(row.basePriceCents || 0),
    discountCents: Number(row.discountCents || 0),
    finalPriceCents: Number(row.finalPriceCents || 0),
    paymentProvider: row.paymentProvider,
    paymentReference: row.paymentReference,
    paymentUrl: row.paymentUrl,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
  };
}

async function refreshPromotionStatus(connection, targetGroup) {
  await connection.query(
    `update premium_promotions
     set status = 'ended'
     where target_group = ?
       and ends_at is not null
       and ends_at <= current_timestamp
       and status <> 'ended'`,
    [targetGroup]
  );

  const [activeRows] = await connection.query(
    `select id
     from premium_promotions
     where target_group = ?
       and starts_at <= current_timestamp
       and (ends_at is null or ends_at > current_timestamp)
     order by starts_at desc, id desc
     limit 1`,
    [targetGroup]
  );

  const activePromotionId = activeRows[0]?.id || null;

  if (activePromotionId) {
    await connection.query(
      `update premium_promotions
       set status = 'ended'
       where target_group = ?
         and id <> ?
         and starts_at <= current_timestamp
         and status <> 'ended'`,
      [targetGroup, activePromotionId]
    );
    await connection.query(`update premium_promotions set status = 'active' where id = ?`, [activePromotionId]);
  } else {
    await connection.query(`update premium_promotions set status = 'ended' where target_group = ? and status = 'active'`, [
      targetGroup,
    ]);
  }

  await connection.query(
    `update premium_promotions
     set status = 'scheduled'
     where target_group = ?
       and starts_at > current_timestamp
       and status <> 'scheduled'`,
    [targetGroup]
  );

  return activePromotionId;
}

async function loadActivePromotion(connection, targetGroup) {
  const [rows] = await connection.query(
    `select
      id,
      target_group as targetGroup,
      name,
      description,
      starts_at as startsAt,
      ends_at as endsAt,
      status,
      created_at as createdAt,
      updated_at as updatedAt
    from premium_promotions
    where target_group = ?
      and status = 'active'
    order by starts_at desc, id desc
    limit 1`,
    [targetGroup]
  );

  return rows[0] ? mapPromotionRow(rows[0]) : null;
}

async function loadPackageForCheckout(connection, targetGroup, packageId, activePromotionId) {
  const promotionCondition = activePromotionId
    ? 'and (promotion_id is null or promotion_id = ?)'
    : 'and promotion_id is null';
  const values = activePromotionId ? [targetGroup, packageId, activePromotionId] : [targetGroup, packageId];

  const [rows] = await connection.query(
    `select
      id,
      target_group as targetGroup,
      promotion_id as promotionId,
      title,
      description,
      price_cents as priceCents,
      duration_days as durationDays,
      display_order as displayOrder,
      active,
      created_at as createdAt,
      updated_at as updatedAt
    from premium_packages
    where target_group = ?
      and id = ?
      and active = 1
      ${promotionCondition}
    limit 1`,
    values
  );

  return rows[0] ? mapPackageRow(rows[0]) : null;
}

async function validateCoupon(connection, targetGroup, couponCode) {
  const normalizedCode = String(couponCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const [rows] = await connection.query(
    `select
      id,
      target_group as targetGroup,
      code,
      description,
      discount_type as discountType,
      discount_value as discountValue,
      usage_limit as usageLimit,
      used_count as usedCount,
      active,
      valid_from as validFrom,
      valid_until as validUntil,
      created_at as createdAt,
      updated_at as updatedAt
    from premium_coupons
    where target_group = ?
      and code = ?
      and active = 1
      and (valid_from is null or valid_from <= current_timestamp)
      and (valid_until is null or valid_until >= current_timestamp)
      and (usage_limit is null or used_count < usage_limit)
    limit 1`,
    [targetGroup, normalizedCode]
  );

  return rows[0] ? mapCouponRow(rows[0]) : null;
}

function calculateDiscountCents(basePriceCents, coupon) {
  if (!coupon) {
    return 0;
  }

  if (coupon.discountType === 'percent') {
    return Math.max(0, Math.min(basePriceCents, Math.round((basePriceCents * coupon.discountValue) / 100)));
  }

  return Math.max(0, Math.min(basePriceCents, Math.round(coupon.discountValue * 100)));
}

async function loadOrders(connection, userId, targetGroup) {
  const [rows] = await connection.query(
    `select
      o.id,
      o.status,
      o.package_id as packageId,
      p.title as packageTitle,
      o.coupon_code as couponCode,
      o.base_price_cents as basePriceCents,
      o.discount_cents as discountCents,
      o.final_price_cents as finalPriceCents,
      o.payment_provider as paymentProvider,
      o.payment_reference as paymentReference,
      o.payment_url as paymentUrl,
      o.created_at as createdAt,
      o.paid_at as paidAt
    from premium_orders o
    join premium_packages p on p.id = o.package_id
    where o.user_id = ?
      and o.target_group = ?
    order by o.created_at desc
    limit 40`,
    [userId, targetGroup]
  );

  return rows.map((row) => mapOrderRow(row));
}

async function loadActiveSubscription(connection, userId, targetGroup) {
  const [rows] = await connection.query(
    `select
      id,
      target_group as targetGroup,
      starts_at as startsAt,
      ends_at as endsAt,
      status
    from premium_subscriptions
    where user_id = ?
      and target_group = ?
      and status = 'active'
      and ends_at > current_timestamp
    order by ends_at desc
    limit 1`,
    [userId, targetGroup]
  );

  return rows[0] || null;
}

export async function listPremiumCatalog(req, res) {
  const targetGroup = resolveTargetGroup(req.user?.role);
  if (!targetGroup) {
    return res.status(403).json({ message: 'Catalogo premium disponivel apenas para usuario e estabelecimento.' });
  }

  try {
    await refreshPromotionStatus(pool, targetGroup);
    const activePromotion = await loadActivePromotion(pool, targetGroup);

    const promotionCondition = activePromotion
      ? 'and (promotion_id is null or promotion_id = ?)'
      : 'and promotion_id is null';
    const values = activePromotion ? [targetGroup, activePromotion.id] : [targetGroup];

    const [packageRows] = await pool.query(
      `select
        id,
        target_group as targetGroup,
        promotion_id as promotionId,
        title,
        description,
        price_cents as priceCents,
        duration_days as durationDays,
        display_order as displayOrder,
        active,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_packages
      where target_group = ?
        and active = 1
        ${promotionCondition}
      order by display_order asc, id asc`,
      values
    );

    const activeSubscription = await loadActiveSubscription(pool, req.user.id, targetGroup);
    const orders = await loadOrders(pool, req.user.id, targetGroup);

    return res.json({
      targetGroup,
      activePromotion,
      activeSubscription,
      packages: packageRows.map((row) => mapPackageRow(row)),
      orders,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar catalogo premium.' });
  }
}

export async function createPremiumCheckout(req, res) {
  const targetGroup = resolveTargetGroup(req.user?.role);
  if (!targetGroup) {
    return res.status(403).json({ message: 'Checkout premium disponivel apenas para usuario e estabelecimento.' });
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para checkout premium.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const activePromotionId = await refreshPromotionStatus(connection, targetGroup);
    const selectedPackage = await loadPackageForCheckout(
      connection,
      targetGroup,
      parsed.data.packageId,
      activePromotionId
    );
    if (!selectedPackage) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pacote premium nao encontrado para este perfil.' });
    }

    let coupon = null;
    if (parsed.data.couponCode) {
      coupon = await validateCoupon(connection, targetGroup, parsed.data.couponCode);
      if (!coupon) {
        await connection.rollback();
        return res.status(400).json({ message: 'Cupom invalido, inativo ou expirado.' });
      }
    }

    const basePriceCents = selectedPackage.priceCents;
    const discountCents = calculateDiscountCents(basePriceCents, coupon);
    const finalPriceCents = Math.max(0, basePriceCents - discountCents);
    const paymentReference = `PM-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const paymentUrl = `https://checkout.mock.bilhete/premium/${paymentReference}`;

    const [insertResult] = await connection.query(
      `insert into premium_orders (
        user_id,
        target_group,
        package_id,
        coupon_id,
        coupon_code,
        base_price_cents,
        discount_cents,
        final_price_cents,
        status,
        payment_provider,
        payment_reference,
        payment_url
      ) values (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'mock', ?, ?)`,
      [
        req.user.id,
        targetGroup,
        selectedPackage.id,
        coupon?.id || null,
        coupon?.code || null,
        basePriceCents,
        discountCents,
        finalPriceCents,
        paymentReference,
        paymentUrl,
      ]
    );

    const [orderRows] = await connection.query(
      `select
        o.id,
        o.status,
        o.package_id as packageId,
        p.title as packageTitle,
        o.coupon_code as couponCode,
        o.base_price_cents as basePriceCents,
        o.discount_cents as discountCents,
        o.final_price_cents as finalPriceCents,
        o.payment_provider as paymentProvider,
        o.payment_reference as paymentReference,
        o.payment_url as paymentUrl,
        o.created_at as createdAt,
        o.paid_at as paidAt
      from premium_orders o
      join premium_packages p on p.id = o.package_id
      where o.id = ?
      limit 1`,
      [insertResult.insertId]
    );

    await connection.commit();
    return res.status(201).json({
      order: orderRows[0] ? mapOrderRow(orderRows[0]) : null,
      selectedPackage,
      coupon,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    return res.status(500).json({ message: 'Erro ao iniciar checkout premium.' });
  } finally {
    connection.release();
  }
}

export async function confirmPremiumOrderPayment(req, res) {
  const targetGroup = resolveTargetGroup(req.user?.role);
  if (!targetGroup) {
    return res.status(403).json({ message: 'Confirmacao premium disponivel apenas para usuario e estabelecimento.' });
  }

  const parsedParams = orderParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'orderId invalido.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `select
        o.id,
        o.user_id as userId,
        o.target_group as targetGroup,
        o.package_id as packageId,
        o.coupon_id as couponId,
        o.status,
        p.duration_days as durationDays
      from premium_orders o
      join premium_packages p on p.id = o.package_id
      where o.id = ?
      limit 1`,
      [parsedParams.data.orderId]
    );

    const order = rows[0];
    if (!order || order.userId !== req.user.id || order.targetGroup !== targetGroup) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pedido premium nao encontrado.' });
    }

    if (order.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ message: 'Este pedido premium nao pode ser confirmado novamente.' });
    }

    await connection.query(`update premium_orders set status = 'paid', paid_at = current_timestamp where id = ?`, [order.id]);

    if (order.couponId) {
      await connection.query(`update premium_coupons set used_count = used_count + 1 where id = ?`, [order.couponId]);
    }

    await connection.query(
      `insert into premium_subscriptions (user_id, target_group, starts_at, ends_at, status)
       values (?, ?, current_timestamp, date_add(current_timestamp, interval ? day), 'active')
       on duplicate key update
         starts_at = case
           when ends_at > current_timestamp then starts_at
           else current_timestamp
         end,
         ends_at = case
           when ends_at > current_timestamp then date_add(ends_at, interval ? day)
           else date_add(current_timestamp, interval ? day)
         end,
         status = 'active',
         updated_at = current_timestamp`,
      [req.user.id, targetGroup, order.durationDays, order.durationDays, order.durationDays]
    );

    if (targetGroup === 'user') {
      await connection.query(
        `insert into profiles (user_id, name, status_social, premium_status, premium_expires_at)
         select id, name, 'observando', 1, date_add(current_timestamp, interval ? day)
         from users
         where id = ?
         on duplicate key update
           premium_status = 1,
           premium_expires_at = case
             when premium_expires_at is null or premium_expires_at < current_timestamp
               then date_add(current_timestamp, interval ? day)
             else date_add(premium_expires_at, interval ? day)
           end`,
        [order.durationDays, req.user.id, order.durationDays, order.durationDays]
      );
    }

    const [orderRows] = await connection.query(
      `select
        o.id,
        o.status,
        o.package_id as packageId,
        p.title as packageTitle,
        o.coupon_code as couponCode,
        o.base_price_cents as basePriceCents,
        o.discount_cents as discountCents,
        o.final_price_cents as finalPriceCents,
        o.payment_provider as paymentProvider,
        o.payment_reference as paymentReference,
        o.payment_url as paymentUrl,
        o.created_at as createdAt,
        o.paid_at as paidAt
      from premium_orders o
      join premium_packages p on p.id = o.package_id
      where o.id = ?
      limit 1`,
      [order.id]
    );

    await connection.commit();
    return res.json({ order: orderRows[0] ? mapOrderRow(orderRows[0]) : null });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    return res.status(500).json({ message: 'Erro ao confirmar pagamento premium.' });
  } finally {
    connection.release();
  }
}

export async function listAdminPremiumPackages(req, res) {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Filtro invalido para pacotes premium.' });
  }

  try {
    const where = [];
    const values = [];
    if (parsed.data.targetGroup) {
      where.push('target_group = ?');
      values.push(parsed.data.targetGroup);
    }

    const [rows] = await pool.query(
      `select
        id,
        target_group as targetGroup,
        promotion_id as promotionId,
        title,
        description,
        price_cents as priceCents,
        duration_days as durationDays,
        display_order as displayOrder,
        active,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_packages
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by target_group asc, display_order asc, id asc`,
      values
    );

    return res.json(rows.map((row) => mapPackageRow(row)));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar pacotes premium.' });
  }
}

export async function createAdminPremiumPackage(req, res) {
  const parsed = packageCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para pacote premium.' });
  }

  const payload = parsed.data;
  try {
    const [insertResult] = await pool.query(
      `insert into premium_packages (
        target_group,
        promotion_id,
        title,
        description,
        price_cents,
        duration_days,
        display_order,
        active
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.targetGroup,
        payload.promotionId || null,
        payload.title,
        payload.description || null,
        payload.priceCents,
        payload.durationDays,
        payload.displayOrder || 0,
        payload.active === false ? 0 : 1,
      ]
    );

    const [rows] = await pool.query(
      `select
        id,
        target_group as targetGroup,
        promotion_id as promotionId,
        title,
        description,
        price_cents as priceCents,
        duration_days as durationDays,
        display_order as displayOrder,
        active,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_packages
      where id = ?
      limit 1`,
      [insertResult.insertId]
    );

    return res.status(201).json(rows[0] ? mapPackageRow(rows[0]) : null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao criar pacote premium.' });
  }
}

export async function updateAdminPremiumPackage(req, res) {
  const parsedParams = packageParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'packageId invalido.' });
  }

  const parsedBody = packageUpdateSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: parsedBody.error.issues[0]?.message || 'Dados invalidos para pacote premium.' });
  }

  const updates = [];
  const values = [];
  const payload = parsedBody.data;

  if (payload.targetGroup !== undefined) {
    updates.push('target_group = ?');
    values.push(payload.targetGroup);
  }
  if (payload.promotionId !== undefined) {
    updates.push('promotion_id = ?');
    values.push(payload.promotionId || null);
  }
  if (payload.title !== undefined) {
    updates.push('title = ?');
    values.push(payload.title);
  }
  if (payload.description !== undefined) {
    updates.push('description = ?');
    values.push(payload.description || null);
  }
  if (payload.priceCents !== undefined) {
    updates.push('price_cents = ?');
    values.push(payload.priceCents);
  }
  if (payload.durationDays !== undefined) {
    updates.push('duration_days = ?');
    values.push(payload.durationDays);
  }
  if (payload.displayOrder !== undefined) {
    updates.push('display_order = ?');
    values.push(payload.displayOrder);
  }
  if (payload.active !== undefined) {
    updates.push('active = ?');
    values.push(payload.active ? 1 : 0);
  }

  values.push(parsedParams.data.packageId);

  try {
    const [result] = await pool.query(`update premium_packages set ${updates.join(', ')} where id = ?`, values);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Pacote premium nao encontrado.' });
    }

    const [rows] = await pool.query(
      `select
        id,
        target_group as targetGroup,
        promotion_id as promotionId,
        title,
        description,
        price_cents as priceCents,
        duration_days as durationDays,
        display_order as displayOrder,
        active,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_packages
      where id = ?
      limit 1`,
      [parsedParams.data.packageId]
    );

    return res.json(rows[0] ? mapPackageRow(rows[0]) : null);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar pacote premium.' });
  }
}

export async function listAdminPremiumCoupons(req, res) {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Filtro invalido para cupons.' });
  }

  try {
    const where = [];
    const values = [];
    if (parsed.data.targetGroup) {
      where.push('target_group = ?');
      values.push(parsed.data.targetGroup);
    }

    const [rows] = await pool.query(
      `select
        id,
        target_group as targetGroup,
        code,
        description,
        discount_type as discountType,
        discount_value as discountValue,
        usage_limit as usageLimit,
        used_count as usedCount,
        active,
        valid_from as validFrom,
        valid_until as validUntil,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_coupons
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by target_group asc, created_at desc, id desc`,
      values
    );

    return res.json(rows.map((row) => mapCouponRow(row)));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar cupons premium.' });
  }
}

export async function createAdminPremiumCoupon(req, res) {
  const parsed = couponCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para cupom premium.' });
  }

  const payload = parsed.data;
  const validFrom = normalizeDateTimeInput(payload.validFrom);
  const validUntil = normalizeDateTimeInput(payload.validUntil);
  if (payload.validFrom && !validFrom) {
    return res.status(400).json({ message: 'Data inicial invalida para cupom.' });
  }
  if (payload.validUntil && !validUntil) {
    return res.status(400).json({ message: 'Data final invalida para cupom.' });
  }
  if (validFrom && validUntil && validUntil <= validFrom) {
    return res.status(400).json({ message: 'Data final do cupom deve ser maior que a inicial.' });
  }
  if (payload.discountType === 'percent' && payload.discountValue > 100) {
    return res.status(400).json({ message: 'Desconto percentual deve ser de no maximo 100%.' });
  }

  try {
    const [insertResult] = await pool.query(
      `insert into premium_coupons (
        target_group,
        code,
        description,
        discount_type,
        discount_value,
        usage_limit,
        active,
        valid_from,
        valid_until
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.targetGroup,
        payload.code.trim().toUpperCase(),
        payload.description || null,
        payload.discountType,
        payload.discountValue,
        payload.usageLimit || null,
        payload.active === false ? 0 : 1,
        validFrom,
        validUntil,
      ]
    );

    const [rows] = await pool.query(
      `select
        id,
        target_group as targetGroup,
        code,
        description,
        discount_type as discountType,
        discount_value as discountValue,
        usage_limit as usageLimit,
        used_count as usedCount,
        active,
        valid_from as validFrom,
        valid_until as validUntil,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_coupons
      where id = ?
      limit 1`,
      [insertResult.insertId]
    );

    return res.status(201).json(rows[0] ? mapCouponRow(rows[0]) : null);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('duplicate')) {
      return res.status(409).json({ message: 'Codigo de cupom ja cadastrado.' });
    }
    return res.status(500).json({ message: 'Erro ao criar cupom premium.' });
  }
}

export async function updateAdminPremiumCoupon(req, res) {
  const parsedParams = couponParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'couponId invalido.' });
  }

  const parsedBody = couponUpdateSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: parsedBody.error.issues[0]?.message || 'Dados invalidos para cupom premium.' });
  }

  const payload = parsedBody.data;
  const validFrom = payload.validFrom !== undefined ? normalizeDateTimeInput(payload.validFrom) : undefined;
  const validUntil = payload.validUntil !== undefined ? normalizeDateTimeInput(payload.validUntil) : undefined;

  if (payload.validFrom !== undefined && payload.validFrom && !validFrom) {
    return res.status(400).json({ message: 'Data inicial invalida para cupom.' });
  }
  if (payload.validUntil !== undefined && payload.validUntil && !validUntil) {
    return res.status(400).json({ message: 'Data final invalida para cupom.' });
  }
  if (payload.discountType === 'percent' && payload.discountValue !== undefined && payload.discountValue > 100) {
    return res.status(400).json({ message: 'Desconto percentual deve ser de no maximo 100%.' });
  }

  const updates = [];
  const values = [];

  if (payload.targetGroup !== undefined) {
    updates.push('target_group = ?');
    values.push(payload.targetGroup);
  }
  if (payload.code !== undefined) {
    updates.push('code = ?');
    values.push(payload.code.trim().toUpperCase());
  }
  if (payload.description !== undefined) {
    updates.push('description = ?');
    values.push(payload.description || null);
  }
  if (payload.discountType !== undefined) {
    updates.push('discount_type = ?');
    values.push(payload.discountType);
  }
  if (payload.discountValue !== undefined) {
    updates.push('discount_value = ?');
    values.push(payload.discountValue);
  }
  if (payload.usageLimit !== undefined) {
    updates.push('usage_limit = ?');
    values.push(payload.usageLimit || null);
  }
  if (payload.active !== undefined) {
    updates.push('active = ?');
    values.push(payload.active ? 1 : 0);
  }
  if (validFrom !== undefined) {
    updates.push('valid_from = ?');
    values.push(validFrom);
  }
  if (validUntil !== undefined) {
    updates.push('valid_until = ?');
    values.push(validUntil);
  }

  values.push(parsedParams.data.couponId);

  try {
    const [result] = await pool.query(`update premium_coupons set ${updates.join(', ')} where id = ?`, values);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Cupom premium nao encontrado.' });
    }

    const [rows] = await pool.query(
      `select
        id,
        target_group as targetGroup,
        code,
        description,
        discount_type as discountType,
        discount_value as discountValue,
        usage_limit as usageLimit,
        used_count as usedCount,
        active,
        valid_from as validFrom,
        valid_until as validUntil,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_coupons
      where id = ?
      limit 1`,
      [parsedParams.data.couponId]
    );

    return res.json(rows[0] ? mapCouponRow(rows[0]) : null);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('duplicate')) {
      return res.status(409).json({ message: 'Codigo de cupom ja cadastrado.' });
    }
    return res.status(500).json({ message: 'Erro ao atualizar cupom premium.' });
  }
}

export async function listAdminPremiumPromotions(req, res) {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Filtro invalido para promocoes.' });
  }

  try {
    if (parsed.data.targetGroup) {
      await refreshPromotionStatus(pool, parsed.data.targetGroup);
    } else {
      await Promise.all(TARGET_GROUPS.map((group) => refreshPromotionStatus(pool, group)));
    }

    const where = [];
    const values = [];
    if (parsed.data.targetGroup) {
      where.push('target_group = ?');
      values.push(parsed.data.targetGroup);
    }

    const [rows] = await pool.query(
      `select
        id,
        target_group as targetGroup,
        name,
        description,
        starts_at as startsAt,
        ends_at as endsAt,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_promotions
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by target_group asc, starts_at desc, id desc`,
      values
    );

    return res.json(rows.map((row) => mapPromotionRow(row)));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar promocoes premium.' });
  }
}

export async function createAdminPremiumPromotion(req, res) {
  const parsed = promotionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para promocao.' });
  }

  const payload = parsed.data;
  const startsAt = normalizeDateTimeInput(payload.startsAt);
  const endsAt = normalizeDateTimeInput(payload.endsAt);
  if (!startsAt) {
    return res.status(400).json({ message: 'Data inicial invalida para promocao.' });
  }
  if (payload.endsAt && !endsAt) {
    return res.status(400).json({ message: 'Data final invalida para promocao.' });
  }
  if (endsAt && endsAt <= startsAt) {
    return res.status(400).json({ message: 'Data final da promocao deve ser maior que a inicial.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.query(
      `insert into premium_promotions (target_group, name, description, starts_at, ends_at, status)
       values (?, ?, ?, ?, ?, 'scheduled')`,
      [payload.targetGroup, payload.name, payload.description || null, startsAt, endsAt]
    );

    await refreshPromotionStatus(connection, payload.targetGroup);

    const [rows] = await connection.query(
      `select
        id,
        target_group as targetGroup,
        name,
        description,
        starts_at as startsAt,
        ends_at as endsAt,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_promotions
      where id = ?
      limit 1`,
      [insertResult.insertId]
    );

    await connection.commit();
    return res.status(201).json(rows[0] ? mapPromotionRow(rows[0]) : null);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    return res.status(500).json({ message: 'Erro ao criar promocao premium.' });
  } finally {
    connection.release();
  }
}

export async function updateAdminPremiumPromotion(req, res) {
  const parsedParams = promotionParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'promotionId invalido.' });
  }

  const parsedBody = promotionUpdateSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: parsedBody.error.issues[0]?.message || 'Dados invalidos para promocao.' });
  }

  const payload = parsedBody.data;
  const startsAt = payload.startsAt !== undefined ? normalizeDateTimeInput(payload.startsAt) : undefined;
  const endsAt = payload.endsAt !== undefined ? normalizeDateTimeInput(payload.endsAt) : undefined;

  if (payload.startsAt !== undefined && !startsAt) {
    return res.status(400).json({ message: 'Data inicial invalida para promocao.' });
  }
  if (payload.endsAt !== undefined && payload.endsAt && !endsAt) {
    return res.status(400).json({ message: 'Data final invalida para promocao.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `select
        id,
        target_group as targetGroup,
        starts_at as startsAt,
        ends_at as endsAt
      from premium_promotions
      where id = ?
      limit 1`,
      [parsedParams.data.promotionId]
    );

    const existing = existingRows[0];
    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ message: 'Promocao premium nao encontrada.' });
    }

    const nextStartsAt = startsAt !== undefined ? startsAt : existing.startsAt;
    const nextEndsAt = endsAt !== undefined ? endsAt : existing.endsAt;
    if (nextEndsAt && nextStartsAt && nextEndsAt <= nextStartsAt) {
      await connection.rollback();
      return res.status(400).json({ message: 'Data final da promocao deve ser maior que a inicial.' });
    }

    const updates = [];
    const values = [];
    if (payload.targetGroup !== undefined) {
      updates.push('target_group = ?');
      values.push(payload.targetGroup);
    }
    if (payload.name !== undefined) {
      updates.push('name = ?');
      values.push(payload.name);
    }
    if (payload.description !== undefined) {
      updates.push('description = ?');
      values.push(payload.description || null);
    }
    if (startsAt !== undefined) {
      updates.push('starts_at = ?');
      values.push(startsAt);
    }
    if (endsAt !== undefined) {
      updates.push('ends_at = ?');
      values.push(endsAt);
    }

    values.push(parsedParams.data.promotionId);
    await connection.query(`update premium_promotions set ${updates.join(', ')} where id = ?`, values);

    const targetGroup = payload.targetGroup || existing.targetGroup;
    await refreshPromotionStatus(connection, targetGroup);

    const [rows] = await connection.query(
      `select
        id,
        target_group as targetGroup,
        name,
        description,
        starts_at as startsAt,
        ends_at as endsAt,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      from premium_promotions
      where id = ?
      limit 1`,
      [parsedParams.data.promotionId]
    );

    await connection.commit();
    return res.json(rows[0] ? mapPromotionRow(rows[0]) : null);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    return res.status(500).json({ message: 'Erro ao atualizar promocao premium.' });
  } finally {
    connection.release();
  }
}
