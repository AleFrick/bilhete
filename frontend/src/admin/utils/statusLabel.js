const STATUS_TRANSLATIONS = {
  approved: 'Aprovado',
  pending: 'Pendente',
  rejected: 'Rejeitado',
  none: 'Nenhum',
  unknown: 'Desconhecido',
  active: 'Ativo',
  inactive: 'Inativo',
  linked: 'Vinculado',
  unlinked: 'Nao vinculado',
  requested: 'Solicitado',
  processing: 'Em processamento',
  completed: 'Concluido',
  cancelled: 'Cancelado',
  denied: 'Negado',
  failed: 'Falhou',
  error: 'Erro',
  open: 'Aberto',
  closed: 'Fechado',
  review: 'Revisao',
  in: 'Em',
  on: 'Em',
};

function toTitleCase(text) {
  const value = String(text || '').trim();
  if (!value) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) {
    return 'Desconhecido';
  }

  const directTranslation = STATUS_TRANSLATIONS[normalized];
  if (directTranslation) {
    return directTranslation;
  }

  const translatedTokens = normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => STATUS_TRANSLATIONS[token] || token);

  if (!translatedTokens.length) {
    return 'Desconhecido';
  }

  return toTitleCase(translatedTokens.join(' '));
}
