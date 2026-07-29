import { z } from 'zod';

import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { processWebhook } from '../services/asaasService.js';

const updateSettingsSchema = z.object({
  environment: z.enum(['sandbox', 'production']).optional(),
  apiKey: z.string().trim().max(255).optional().or(z.literal('')),
  apiUrl: z.string().trim().max(255).optional().or(z.literal('')),
  webhookToken: z.string().trim().max(255).optional().or(z.literal('')),
  enabled: z.boolean().optional(),
});

function mapSettingsRow(row) {
  return {
    provider: row.provider,
    environment: row.environment,
    apiKey: row.api_key ? `${row.api_key.slice(0, 6)}...${row.api_key.slice(-4)}` : '',
    apiKeySet: Boolean(row.api_key),
    apiUrl: row.api_url || '',
    webhookToken: row.webhook_token ? '***' : '',
    webhookTokenSet: Boolean(row.webhook_token),
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at,
  };
}

export async function getPaymentSettings(req, res) {
  try {
    const [rows] = await pool.query(
      `select provider, environment, api_key, api_url, webhook_token, enabled, updated_at from payment_settings where id = 1 limit 1`
    );

    if (!rows.length) {
      return res.json({
        provider: 'asaas',
        environment: env.asaasEnvironment,
        apiKey: '',
        apiKeySet: Boolean(env.asaasApiKey),
        apiUrl: env.asaasApiUrl,
        webhookToken: '',
        webhookTokenSet: Boolean(env.asaasWebhookToken),
        enabled: false,
        updatedAt: null,
      });
    }

    return res.json(mapSettingsRow(rows[0]));
  } catch (error) {
    console.error('[paymentSettings] get error:', error?.message);
    return res.status(500).json({ message: 'Erro ao carregar configuracoes de pagamento.' });
  }
}

export async function updatePaymentSettings(req, res) {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para configuracao de pagamento.' });
  }

  const payload = parsed.data;

  try {
    const [existing] = await pool.query(`select id from payment_settings where id = 1 limit 1`);

    if (!existing.length) {
      await pool.query(
        `insert into payment_settings (id, provider, environment, api_key, api_url, webhook_token, enabled)
         values (1, 'asaas', ?, ?, ?, ?, ?)`,
        [
          payload.environment || 'sandbox',
          payload.apiKey || null,
          payload.apiUrl || null,
          payload.webhookToken || null,
          payload.enabled ? 1 : 0,
        ]
      );
    } else {
      const updates = [];
      const values = [];

      if (payload.environment !== undefined) {
        updates.push('environment = ?');
        values.push(payload.environment);
      }
      if (payload.apiKey !== undefined && payload.apiKey !== '') {
        updates.push('api_key = ?');
        values.push(payload.apiKey);
      }
      if (payload.apiUrl !== undefined) {
        updates.push('api_url = ?');
        values.push(payload.apiUrl || null);
      }
      if (payload.webhookToken !== undefined && payload.webhookToken !== '') {
        updates.push('webhook_token = ?');
        values.push(payload.webhookToken);
      }
      if (payload.enabled !== undefined) {
        updates.push('enabled = ?');
        values.push(payload.enabled ? 1 : 0);
      }

      if (updates.length > 0) {
        values.push(1);
        await pool.query(`update payment_settings set ${updates.join(', ')} where id = ?`, values);
      }
    }

    const [rows] = await pool.query(
      `select provider, environment, api_key, api_url, webhook_token, enabled, updated_at from payment_settings where id = 1 limit 1`
    );

    return res.json(mapSettingsRow(rows[0]));
  } catch (error) {
    console.error('[paymentSettings] update error:', error?.message);
    return res.status(500).json({ message: 'Erro ao salvar configuracoes de pagamento.' });
  }
}

export async function asaasWebhook(req, res) {
  try {
    const result = await processWebhook(req.body);
    console.log('[asaasWebhook] processed:', JSON.stringify(result));
    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    console.error('[asaasWebhook] error:', error?.message);
    return res.status(500).json({ received: false, error: 'Webhook processing failed' });
  }
}
