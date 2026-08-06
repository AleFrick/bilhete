/**
 * Catálogo canônico de códigos de benefício premium.
 *
 * Este arquivo é a FONTE DE VERDADE ESTRUTURAL dos benefícios:
 *   - code: identificador único do benefício (chave que o backend consulta)
 *   - targetGroup: grupo alvo ('user' | 'establishment')
 *   - paramSchema: contrato dos parâmetros que o benefício aceita
 *
 * Os campos label/description são DEFAULTS e podem ser sobrescritos pelo
 * admin via UI (banco) sem serem clobberados pelo sync.
 *
 * Os campos enforced/active são decisão de ops/admin (banco) e nunca
 * são tocados pelo script de sync.
 *
 * Para adicionar um benefício novo:
 *   1. Adicione uma entrada aqui (estrutura + defaults).
 *   2. Rode `npm run sync:benefits` para popular o banco.
 *   3. Implemente o handler em premiumBenefits.js (BENEFIT_HANDLERS) e
 *      marque enforced=1 no banco (via admin ou migration).
 *
 * O script scripts/syncBenefitCodes.js consome este array.
 */
export const BENEFIT_CODES = [
  {
    code: 'FREE_MSG_NO_MATCH',
    targetGroup: 'user',
    paramSchema: {
      dailyLimit: { type: 'number', min: 0, default: 1 },
    },
    label: 'Mensagem livre (sem match)',
    description: 'Permite enviar mensagem sem precisar de match.',
  },
  {
    code: 'EXTRA_DAILY_BILHETES',
    targetGroup: 'user',
    paramSchema: {
      dailyLimit: { type: 'number', min: 0, default: 5 },
    },
    label: 'Mais bilhetes diários',
    description: 'Aumenta a cota diária de bilhetes enviados.',
  },
  {
    code: 'PROFILE_VISITORS',
    targetGroup: 'user',
    paramSchema: {
      retentionDays: { type: 'number', min: 0, default: 30 },
    },
    label: 'Ver quem visitou seu perfil',
    description: 'Exibe o histórico de visitantes do perfil.',
  },
  {
    code: 'VENUE_HIGHLIGHT',
    targetGroup: 'user',
    paramSchema: {
      boostHours: { type: 'number', min: 0, default: 24 },
    },
    label: 'Destaque no local',
    description: 'Destaca o perfil do usuário nos locais frequentados.',
  },
  {
    code: 'INVISIBLE_MODE',
    targetGroup: 'user',
    paramSchema: {
      enabled: { type: 'boolean', default: true },
    },
    label: 'Modo invisível',
    description: 'Oculta a presença/visualizações do usuário.',
  },
  {
    code: 'PRIORITY_SUPPORT',
    targetGroup: 'user',
    paramSchema: {
      slaHours: { type: 'number', min: 0, default: 24 },
    },
    label: 'Suporte prioritário',
    description: 'Atendimento de suporte com prioridade e SLA reduzido.',
  },
];
