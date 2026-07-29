import { pool } from '../config/db.js';
import { env } from '../config/env.js';

async function getPaymentSettings() {
  const [rows] = await pool.query(
    `select provider, environment, api_key, api_url, webhook_token, enabled from payment_settings where id = 1 limit 1`
  );
  if (!rows.length) {
    return {
      provider: 'asaas',
      environment: env.asaasEnvironment,
      api_key: env.asaasApiKey,
      api_url: env.asaasApiUrl,
      webhook_token: env.asaasWebhookToken,
      enabled: false,
    };
  }
  const row = rows[0];
  return {
    provider: row.provider,
    environment: row.environment,
    apiKey: row.api_key || env.asaasApiKey,
    apiUrl: row.api_url || env.asaasApiUrl,
    webhookToken: row.webhook_token || env.asaasWebhookToken,
    enabled: Boolean(row.enabled),
  };
}

function resolveApiUrl(settings) {
  if (settings.environment === 'production') {
    return 'https://api.asaas.com';
  }
  return 'https://sandbox.asaas.com';
}

async function asaasRequest(path, options = {}, settings) {
  const baseUrl = resolveApiUrl(settings);
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': settings.apiKey,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.errors?.[0]?.description || data?.message || `Asaas API error ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function getOrCreateCustomer(user) {
  const [existing] = await pool.query(
    `select provider_customer_id from payment_customers where user_id = ? and provider = 'asaas' limit 1`,
    [user.id]
  );

  if (existing.length > 0) {
    return existing[0].provider_customer_id;
  }

  const settings = await getPaymentSettings();
  if (!settings.enabled || !settings.apiKey) {
    throw new Error('Pagamento nao configurado.');
  }

  const customerData = await asaasRequest(
    '/api/v3/customers',
    {
      method: 'POST',
      body: JSON.stringify({
        name: user.name || 'Cliente Bilhete',
        email: user.email,
        externalReference: String(user.id),
      }),
    },
    settings
  );

  await pool.query(
    `insert into payment_customers (user_id, provider, provider_customer_id) values (?, 'asaas', ?)`,
    [user.id, customerData.id]
  );

  return customerData.id;
}

export async function createAsaasPayment({ user, packageTitle, finalPriceCents, paymentReference, billingType = 'UNDEFINED' }) {
  const settings = await getPaymentSettings();
  if (!settings.enabled || !settings.apiKey) {
    throw new Error('Pagamento nao configurado. Contate o administrador.');
  }

  const customerId = await getOrCreateCustomer(user);

  const paymentData = await asaasRequest(
    '/api/v3/payments',
    {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value: (finalPriceCents / 100).toFixed(2),
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        description: packageTitle,
        externalReference: paymentReference,
      }),
    },
    settings
  );

  return {
    providerPaymentId: paymentData.id,
    invoiceUrl: paymentData.invoiceUrl || paymentData.bankSlipUrl || null,
    checkoutUrl: paymentData.invoiceUrl || null,
    billingType: paymentData.billingType,
  };
}

export async function getAsaasPaymentStatus(providerPaymentId) {
  const settings = await getPaymentSettings();
  if (!settings.apiKey) {
    return null;
  }

  const data = await asaasRequest(
    `/api/v3/payments/${providerPaymentId}`,
    { method: 'GET' },
    settings
  );

  return data.status;
}

export async function processWebhook(payload) {
  const event = payload?.event;
  const payment = payload?.payment;

  if (!payment) {
    return { processed: false, reason: 'no payment data' };
  }

  const statusMap = {
    'CONFIRMED': 'paid',
    'RECEIVED': 'paid',
    'OVERDUE': 'failed',
    'REFUNDED': 'cancelled',
  };

  const newStatus = statusMap[event] || null;
  if (!newStatus) {
    return { processed: false, reason: `unmapped event: ${event}` };
  }

  const [orders] = await pool.query(
    `select id, status from premium_orders where payment_reference = ? limit 1`,
    [payment.externalReference || '']
  );

  if (!orders.length) {
    return { processed: false, reason: 'order not found' };
  }

  const order = orders[0];
  if (order.status === newStatus) {
    return { processed: true, reason: 'already updated' };
  }

  if (newStatus === 'paid') {
    await pool.query(`update premium_orders set status = 'paid', paid_at = current_timestamp where id = ?`, [order.id]);

    const [orderRows] = await pool.query(
      `select o.user_id as userId, o.target_group as targetGroup, p.duration_days as durationDays
       from premium_orders o
       join premium_packages p on p.id = o.package_id
       where o.id = ? limit 1`,
      [order.id]
    );

    if (orderRows.length > 0) {
      const ord = orderRows[0];
      await pool.query(
        `insert into premium_subscriptions (user_id, target_group, starts_at, ends_at, status)
         values (?, ?, current_timestamp, date_add(current_timestamp, interval ? day), 'active')
         on duplicate key update
           starts_at = case when ends_at > current_timestamp then starts_at else current_timestamp end,
           ends_at = case when ends_at > current_timestamp then date_add(ends_at, interval ? day) else date_add(current_timestamp, interval ? day) end,
           status = 'active',
           updated_at = current_timestamp`,
        [ord.userId, ord.targetGroup, ord.durationDays, ord.durationDays, ord.durationDays]
      );

      if (ord.targetGroup === 'user') {
        await pool.query(
          `insert into profiles (user_id, name, status_social, premium_status, premium_expires_at)
           select id, name, 'observando', 1, date_add(current_timestamp, interval ? day)
           from users where id = ?
           on duplicate key update
             premium_status = 1,
             premium_expires_at = case
               when premium_expires_at is null or premium_expires_at < current_timestamp
                 then date_add(current_timestamp, interval ? day)
               else date_add(premium_expires_at, interval ? day)
             end`,
          [ord.durationDays, ord.userId, ord.durationDays, ord.durationDays]
        );
      }
    }
  } else {
    await pool.query(`update premium_orders set status = ? where id = ?`, [newStatus, order.id]);
  }

  return { processed: true, orderId: order.id, newStatus };
}

export { getPaymentSettings };
