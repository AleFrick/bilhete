import { pool } from '../config/db.js';

/**
 * Mapa de handlers de benefício efetivamente aplicados pelo backend.
 * A chave é o `code` do catálogo (premium_benefit_catalog.code).
 * O valor é uma função `enforce(params, context)` chamada quando o gate
 * precisa aplicar o comportamento (ex: limitar envio de mensagem livre).
 *
 * Codes presentes no catálogo mas ausentes deste mapa ficam sem efeito
 * (premium_benefit_catalog.enforced = 0). O admin vê isso claramente.
 *
 * Para adicionar um handler novo: registre aqui E marque enforced=1 no
 * catálogo (via migration ou admin). Nesta fase todos começam enforced=0.
 */
export const BENEFIT_HANDLERS = {
  EXTRA_DAILY_BILHETES: {
    description: 'Aumenta a cota diária de bilhetes enviados.',
    // O handler real está no bilheteController.sendBilhete, que consulta
    // resolveBenefit(userId, 'user', 'EXTRA_DAILY_BILHETES') para obter
    // params.dailyLimit e somar ao BASE_DAILY_BILHETE_LIMIT.
  },
  // FREE_MSG_NO_MATCH: handler piloto (a implementar em fase posterior)
  // PROFILE_VISITORS: a implementar
  // VENUE_HIGHLIGHT: a implementar
  // INVISIBLE_MODE: a implementar
  // PRIORITY_SUPPORT: a implementar
};

/**
 * Conjunto de codes que o backend sabe aplicar (derivado de BENEFIT_HANDLERS).
 * Usado para espelhar/validar a flag `enforced` do catálogo.
 */
export const ENFORCED_CODES = new Set(Object.keys(BENEFIT_HANDLERS));

/**
 * Normaliza um item de benefício (legado string ou objeto) para o shape canônico:
 * { code, label, params }.
 */
export function normalizeBenefitItem(item) {
  if (item === null || item === undefined) return null;
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;
    return { code: 'LEGACY', label: trimmed, params: {} };
  }
  if (typeof item === 'object') {
    const code = String(item.code || '').trim();
    const label = String(item.label || '').trim();
    const params = item.params && typeof item.params === 'object' ? item.params : {};
    if (!code) return null;
    return { code, label, params };
  }
  return null;
}

/**
 * Normaliza um array de benefícios (legado ou novo) para o shape canônico.
 */
export function normalizeBenefits(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeBenefitItem)
    .filter(Boolean);
}

/**
 * Resolve um benefício específico para um usuário, consultando o snapshot
 * da assinatura ativa. Retorna { params } ou null se o usuário não possui
 * aquele benefício (ou não tem assinatura ativa).
 *
 * @param {number} userId
 * @param {'user'|'establishment'} targetGroup
 * @param {string} code
 * @returns {Promise<{ params: object } | null>}
 */
export async function resolveBenefit(userId, targetGroup, code) {
  if (!userId || !targetGroup || !code) return null;
  const [rows] = await pool.query(
    `select benefits_snapshot
     from premium_subscriptions
     where user_id = ?
       and target_group = ?
       and status = 'active'
       and ends_at > current_timestamp
     limit 1`,
    [userId, targetGroup]
  );
  const snapshot = rows[0]?.benefits_snapshot;
  if (!snapshot) return null;
  const benefits = normalizeBenefits(typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot);
  const found = benefits.find((b) => b.code === code);
  return found ? { params: found.params || {} } : null;
}

/**
 * Atalho booleano: usuário possui o benefício (ativo)?
 */
export async function hasBenefit(userId, targetGroup, code) {
  const resolved = await resolveBenefit(userId, targetGroup, code);
  return resolved !== null;
}

/**
 * Carrega o catálogo de benefícios do banco (ativos), opcionalmente filtrado
 * por target_group. Retorna array normalizado com param_schema parseado.
 */
export async function loadBenefitCatalog(targetGroup) {
  const where = ['active = 1'];
  const values = [];
  if (targetGroup) {
    where.push('target_group = ?');
    values.push(targetGroup);
  }
  const [rows] = await pool.query(
    `select
       id,
       code,
       label,
       description,
       target_group as targetGroup,
       param_schema as paramSchema,
       enforced,
       active,
       created_at as createdAt,
       updated_at as updatedAt
     from premium_benefit_catalog
     where ${where.join(' and ')}
     order by target_group asc, code asc`,
    values
  );
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description,
    targetGroup: row.targetGroup,
    paramSchema: parseParamSchema(row.paramSchema),
    enforced: Boolean(row.enforced),
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

function parseParamSchema(raw) {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
