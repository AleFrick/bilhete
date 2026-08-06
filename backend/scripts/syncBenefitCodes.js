/**
 * Sincroniza os códigos de benefício do fonte (premiumBenefitCodes.js)
 * para o banco (premium_benefit_catalog).
 *
 * Estratégia (Opção C — split):
 *   - Estrutura (code, target_group, param_schema): upsert — fonte é verdade.
 *   - Defaults (label, description): só aplicados na inserção; se o code já
 *     existe no banco, NÃO sobrescreve (admin pode ter customizado).
 *   - Runtime config (enforced, active): nunca tocados pelo script.
 *
 * Uso: npm run sync:benefits
 */
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import { BENEFIT_CODES } from '../src/services/premiumBenefitCodes.js';

function parseJsonSafe(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/** Comparação semântica de dois valores JSON (ignora ordem de chaves). */
function deepEqualJson(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqualJson(item, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqualJson(a[key], b[key]));
}

async function run() {
  const connection = await mysql.createConnection({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    database: env.mysqlDatabase,
    multipleStatements: true,
  });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (const item of BENEFIT_CODES) {
      const paramSchemaJson = JSON.stringify(item.paramSchema);

      // Verifica se já existe (pelo code, único).
      const [existing] = await connection.query(
        `select id, target_group as targetGroup, param_schema as paramSchema
         from premium_benefit_catalog
         where code = ?
         limit 1`,
        [item.code]
      );

      if (existing.length === 0) {
        // Insere com defaults completos (label, description, param_schema).
        // enforced=0 e active=1 por padrão da tabela.
        await connection.query(
          `insert into premium_benefit_catalog
             (code, label, description, target_group, param_schema, enforced, active)
           values (?, ?, ?, ?, ?, 0, 1)`,
          [item.code, item.label, item.description, item.targetGroup, paramSchemaJson]
        );
        inserted++;
        console.log(`[insert] ${item.code} (${item.targetGroup})`);
      } else {
        // Já existe: upsert só da estrutura (target_group, param_schema).
        // Não toca em label, description, enforced, active.
        const row = existing[0];
        const currentParamSchema = parseJsonSafe(row.paramSchema);
        const sourceParamSchema = item.paramSchema;

        const schemaChanged = !deepEqualJson(currentParamSchema, sourceParamSchema);
        const groupChanged = row.targetGroup !== item.targetGroup;

        if (schemaChanged || groupChanged) {
          await connection.query(
            `update premium_benefit_catalog
             set target_group = ?, param_schema = ?
             where id = ?`,
            [item.targetGroup, paramSchemaJson, row.id]
          );
          updated++;
          console.log(`[update] ${item.code} (estrutura atualizada)`);
        } else {
          skipped++;
          console.log(`[skip]   ${item.code} (já em sync)`);
        }
      }
    }

    // Verifica codes no banco que não existem no fonte (orphan check).
    const codesInSource = BENEFIT_CODES.map((c) => c.code);
    const placeholders = codesInSource.map(() => '?').join(',');
    const [orphans] = await connection.query(
      `select code, target_group as targetGroup, active, enforced
       from premium_benefit_catalog
       where code not in (${placeholders})`,
      codesInSource
    );

    console.log('');
    console.log(`Sync concluído: ${inserted} inseridos, ${updated} atualizados, ${skipped} ignorados.`);

    if (orphans.length) {
      console.log('');
      console.log('[warn] Codes no banco que NÃO existem no fonte (orphan):');
      for (const o of orphans) {
        console.log(`  - ${o.code} (${o.targetGroup}, active=${o.active ? 1 : 0}, enforced=${o.enforced ? 1 : 0})`);
      }
      console.log('[warn] Considere adicioná-los ao fonte ou removê-los do banco.');
    }
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
