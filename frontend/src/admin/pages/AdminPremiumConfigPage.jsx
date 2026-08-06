import { useEffect, useMemo, useRef, useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';
import Modal from '../../components/Modal';

const TARGET_GROUP_OPTIONS = [
  { value: 'user', label: 'Usuários' },
  { value: 'establishment', label: 'Estabelecimentos' },
];

/** Formata string de dígitos (centavos) → "1.990,00" */
function formatCurrencyDisplay(rawDigits) {
  const digits = String(rawDigits).replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toDatetimeLocalValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const TABS = [
  { key: 'packages', label: 'Pacotes' },
  { key: 'benefits', label: 'Benefícios' },
  { key: 'promotions', label: 'Promoções' },
  { key: 'coupons', label: 'Cupons' },
];

const MODAL_NONE = null;
const MODAL_PACKAGE = 'package';
const MODAL_COUPON = 'coupon';
const MODAL_PROMOTION = 'promotion';
const MODAL_BENEFIT = 'benefit';

/** Normaliza um item de benefício (legado string ou objeto) para o shape canônico. */
function normalizeBenefitItem(item) {
  if (item === null || item === undefined) return null;
  if (typeof item === 'string') {
    const trimmed = item.trim();
    return trimmed ? { code: 'LEGACY', label: trimmed, params: {} } : null;
  }
  if (typeof item === 'object') {
    const code = String(item.code || '').trim();
    if (!code) return null;
    return {
      code,
      label: String(item.label || '').trim(),
      params: item.params && typeof item.params === 'object' ? item.params : {},
    };
  }
  return null;
}

function normalizeBenefitsForForm(raw) {
  if (!Array.isArray(raw) || !raw.length) return [makeEmptyBenefitItem()];
  const normalized = raw.map(normalizeBenefitItem).filter(Boolean);
  return normalized.length ? normalized : [makeEmptyBenefitItem()];
}

function makeEmptyBenefitItem() {
  return { code: '', label: '', params: {} };
}

const makeEmptyPackageForm = (targetGroup) => ({
  targetGroup,
  title: '',
  description: '',
  benefits: [makeEmptyBenefitItem()],
  isFree: false,
  priceCents: '', // dígitos brutos em centavos (ex: "1990" = R$19,90)
  durationDays: '',
  displayOrder: '0',
  promotionId: '',
  active: true,
});

const EMPTY_COUPON_FORM = {
  code: '',
  description: '',
  discountType: 'percent',
  discountValue: '',
  usageLimit: '',
  validFrom: '',
  validUntil: '',
  active: true,
};

const EMPTY_PROMOTION_FORM = {
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
};

const EMPTY_BENEFIT_FORM = {
  code: '',
  label: '',
  description: '',
  targetGroup: 'user',
  paramSchema: '',
  enforced: false,
  active: true,
};

/** Parseia o texto JSON do campo paramSchema do formulário do catálogo. */
function parseParamSchemaText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Formata o param_schema (objeto) para edição no textarea do catálogo. */
function formatParamSchemaText(schema) {
  if (!schema || typeof schema !== 'object') return '';
  try {
    return JSON.stringify(schema, null, 2);
  } catch {
    return '';
  }
}

/** Renderiza os campos dinâmicos de params a partir do param_schema do catálogo. */
function renderParamFields(paramSchema, params, onChange) {
  const entries = Object.entries(paramSchema || {});
  if (!entries.length) {
    return <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Sem parâmetros para este benefício.</p>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
      {entries.map(([key, def]) => {
        const type = def?.type || 'string';
        const value = params?.[key] ?? def?.default ?? '';
        const handle = (nextValue) => onChange({ ...params, [key]: nextValue });
        if (type === 'boolean') {
          return (
            <label key={key} className="admin-checkbox" style={{ minWidth: '120px' }}>
              <input type="checkbox" checked={Boolean(value)} onChange={(e) => handle(e.target.checked)} />
              {key}
            </label>
          );
        }
        return (
          <label key={key} style={{ minWidth: '120px' }}>
            {key}
            <input
              type={type === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => handle(type === 'number' ? Number(e.target.value) : e.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}

/** Extrai os valores default de params a partir do param_schema do catálogo. */
function defaultParamsFromSchema(paramSchema) {
  const out = {};
  for (const [key, def] of Object.entries(paramSchema || {})) {
    if (def && Object.prototype.hasOwnProperty.call(def, 'default')) {
      out[key] = def.default;
    }
  }
  return out;
}

/** Converte objeto params em array de pares { key, value } para edição no modal. */
function paramsToPairs(params) {
  if (!params || typeof params !== 'object') return [];
  return Object.entries(params).map(([key, value]) => ({
    key,
    value: typeof value === 'boolean' ? String(value) : String(value ?? ''),
  }));
}

/** Converte array de pares { key, value } de volta para objeto params.
 *  Tenta converter valores numéricos e booleanos. */
function pairsToParams(pairs) {
  const out = {};
  for (const pair of pairs) {
    const key = String(pair.key || '').trim();
    if (!key) continue;
    const raw = String(pair.value ?? '').trim();
    if (raw === '') {
      out[key] = '';
    } else if (raw === 'true' || raw === 'false') {
      out[key] = raw === 'true';
    } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
      out[key] = Number(raw);
    } else {
      out[key] = raw;
    }
  }
  return out;
}

/** Resumo legível dos params para exibir abaixo do botão. */
function summarizeParams(params) {
  if (!params || typeof params !== 'object') return 'Sem parâmetros';
  const entries = Object.entries(params);
  if (!entries.length) return 'Sem parâmetros';
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

/** Verifica se o código do benefício no índice dado está repetido em outro item. */
function isDuplicateBenefitCode(benefits, index) {
  const code = benefits[index]?.code;
  if (!code) return false;
  return benefits.some((b, i) => i !== index && b.code === code);
}

/** Retorna true se há qualquer código duplicado no array de benefícios. */
function hasDuplicateBenefitCodes(benefits) {
  const codes = benefits.map((b) => b.code).filter(Boolean);
  return new Set(codes).size !== codes.length;
}

export default function AdminPremiumConfigPage() {
  const [targetGroup, setTargetGroup] = useState('user');
  const [activeTab, setActiveTab] = useState('packages');
  const [packages, setPackages] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [benefitCatalog, setBenefitCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [modalError, setModalError] = useState('');

  const [activeModal, setActiveModal] = useState(MODAL_NONE);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef(null);

  const [editingPackageId, setEditingPackageId] = useState(null);
  const [packageForm, setPackageForm] = useState(() => makeEmptyPackageForm('user'));

  const [editingCouponId, setEditingCouponId] = useState(null);
  const [couponForm, setCouponForm] = useState(EMPTY_COUPON_FORM);

  const [editingPromotionId, setEditingPromotionId] = useState(null);
  const [promotionForm, setPromotionForm] = useState(EMPTY_PROMOTION_FORM);

  const [editingBenefitId, setEditingBenefitId] = useState(null);
  const [benefitForm, setBenefitForm] = useState(EMPTY_BENEFIT_FORM);

  const [paramsModalOpen, setParamsModalOpen] = useState(false);
  const [paramsEditingIndex, setParamsEditingIndex] = useState(null);
  const [paramsDraft, setParamsDraft] = useState([{ key: '', value: '' }]);

  const activePromotion = useMemo(() => promotions.find((item) => item.status === 'active') || null, [promotions]);

  /** Catálogo filtrado pelo targetGroup atual (para popular o select de benefits do pacote). */
  const catalogForGroup = useMemo(
    () => benefitCatalog.filter((item) => item.targetGroup === targetGroup && item.active),
    [benefitCatalog, targetGroup]
  );

  const loadData = async () => {
    setLoading(true);
    setPageError('');
    try {
      const results = await Promise.allSettled([
        adminApi.adminPremiumPackages({ targetGroup }),
        adminApi.adminPremiumCoupons({ targetGroup }),
        adminApi.adminPremiumPromotions({ targetGroup }),
        adminApi.adminPremiumBenefitCatalog({ targetGroup }),
      ]);
      const [packagesR, couponsR, promotionsR, catalogR] = results;
      const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message).filter(Boolean);
      if (errors.length) {
        setPageError(`Falha ao carregar: ${errors.join('; ')}`);
      }
      setPackages(packagesR.status === 'fulfilled' ? packagesR.value || [] : []);
      setCoupons(couponsR.status === 'fulfilled' ? couponsR.value || [] : []);
      setPromotions(promotionsR.status === 'fulfilled' ? promotionsR.value || [] : []);
      setBenefitCatalog(catalogR.status === 'fulfilled' ? catalogR.value || [] : []);
    } catch (requestError) {
      setPageError(requestError.message || 'Erro ao carregar configuração premium.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetGroup]);

  useEffect(() => {
    if (!showAddMenu) return undefined;

    const handleClickOutside = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setShowAddMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

  const openModal = (modal) => {
    setModalError('');
    setActiveModal(modal);
    setShowAddMenu(false);
  };

  const closeModal = () => {
    setActiveModal(MODAL_NONE);
    setModalError('');
    setEditingPackageId(null);
    setPackageForm(makeEmptyPackageForm(targetGroup));
    setEditingCouponId(null);
    setCouponForm(EMPTY_COUPON_FORM);
    setEditingPromotionId(null);
    setPromotionForm(EMPTY_PROMOTION_FORM);
    setEditingBenefitId(null);
    setBenefitForm(EMPTY_BENEFIT_FORM);
    closeParamsModal();
  };

  const handleSavePackage = async (event) => {
    event.preventDefault();
    setSaving(true);
    setModalError('');
    setPageSuccess('');

    const normalizedBenefits = packageForm.benefits
      .map(normalizeBenefitItem)
      .filter(Boolean)
      .filter((b) => b.code !== 'LEGACY' || b.label);

    if (hasDuplicateBenefitCodes(normalizedBenefits)) {
      setModalError('Não é permitido repetir o mesmo código de benefício em um pacote.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        targetGroup: packageForm.targetGroup,
        title: packageForm.title,
        description: packageForm.description,
        benefits: normalizedBenefits,
        isFree: Boolean(packageForm.isFree),
        priceCents: packageForm.isFree ? 0 : Number(packageForm.priceCents || 0),
        durationDays: packageForm.isFree ? 3650 : Number(packageForm.durationDays),
        displayOrder: Number(packageForm.displayOrder || 0),
        promotionId: packageForm.promotionId ? Number(packageForm.promotionId) : null,
        active: Boolean(packageForm.active),
      };

      if (editingPackageId) {
        await adminApi.updateAdminPremiumPackage(editingPackageId, payload);
        setPageSuccess('Pacote premium atualizado.');
      } else {
        await adminApi.createAdminPremiumPackage(payload);
        setPageSuccess('Pacote premium criado.');
      }
      closeModal();
      await loadData();
    } catch (requestError) {
      setModalError(requestError.message || 'Erro ao salvar pacote premium.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCoupon = async (event) => {
    event.preventDefault();
    setSaving(true);
    setModalError('');
    setPageSuccess('');
    try {
      const payload = {
        targetGroup,
        code: couponForm.code,
        description: couponForm.description,
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue),
        usageLimit: couponForm.usageLimit ? Number(couponForm.usageLimit) : undefined,
        validFrom: couponForm.validFrom || '',
        validUntil: couponForm.validUntil || '',
        active: Boolean(couponForm.active),
      };

      if (editingCouponId) {
        await adminApi.updateAdminPremiumCoupon(editingCouponId, payload);
        setPageSuccess('Cupom atualizado.');
      } else {
        await adminApi.createAdminPremiumCoupon(payload);
        setPageSuccess('Cupom criado.');
      }
      closeModal();
      await loadData();
    } catch (requestError) {
      setModalError(requestError.message || 'Erro ao salvar cupom.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePromotion = async (event) => {
    event.preventDefault();
    setSaving(true);
    setModalError('');
    setPageSuccess('');
    try {
      const payload = {
        targetGroup,
        name: promotionForm.name,
        description: promotionForm.description,
        startsAt: promotionForm.startsAt,
        endsAt: promotionForm.endsAt || '',
      };

      if (editingPromotionId) {
        await adminApi.updateAdminPremiumPromotion(editingPromotionId, payload);
        setPageSuccess('Promoção atualizada.');
      } else {
        await adminApi.createAdminPremiumPromotion(payload);
        setPageSuccess('Promoção criada. Se estiver no período, ela encerra a anterior automaticamente.');
      }
      closeModal();
      await loadData();
    } catch (requestError) {
      setModalError(requestError.message || 'Erro ao salvar promoção.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBenefit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setModalError('');
    setPageSuccess('');
    try {
      const paramSchema = parseParamSchemaText(benefitForm.paramSchema);
      if (paramSchema === null) {
        setModalError('param_schema inválido. Use um JSON objeto (ex: {"dailyLimit":{"type":"number","default":1}}).');
        setSaving(false);
        return;
      }
      const payload = {
        code: benefitForm.code,
        label: benefitForm.label,
        description: benefitForm.description,
        targetGroup: benefitForm.targetGroup,
        paramSchema,
        enforced: Boolean(benefitForm.enforced),
        active: Boolean(benefitForm.active),
      };

      if (editingBenefitId) {
        await adminApi.updateAdminPremiumBenefitCatalog(editingBenefitId, payload);
        setPageSuccess('Benefício do catálogo atualizado.');
      } else {
        await adminApi.createAdminPremiumBenefitCatalog(payload);
        setPageSuccess('Benefício do catálogo criado.');
      }
      closeModal();
      await loadData();
    } catch (requestError) {
      setModalError(requestError.message || 'Erro ao salvar benefício do catálogo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBenefit = async (benefitId) => {
    if (!window.confirm('Remover este benefício do catálogo? Pacotes que o referenciem ficarão com referência inválida.')) {
      return;
    }
    setPageError('');
    setPageSuccess('');
    try {
      await adminApi.deleteAdminPremiumBenefitCatalog(benefitId);
      setPageSuccess('Benefício removido do catálogo.');
      await loadData();
    } catch (requestError) {
      setPageError(requestError.message || 'Erro ao remover benefício.');
    }
  };

  const openParamsModal = (index) => {
    const benefit = packageForm.benefits[index];
    setParamsEditingIndex(index);
    const pairs = paramsToPairs(benefit?.params);
    setParamsDraft(pairs.length ? pairs : [{ key: '', value: '' }]);
    setParamsModalOpen(true);
  };

  const closeParamsModal = () => {
    setParamsModalOpen(false);
    setParamsEditingIndex(null);
    setParamsDraft([{ key: '', value: '' }]);
  };

  const handleSaveParams = () => {
    const nextParams = pairsToParams(paramsDraft);
    if (paramsEditingIndex !== null) {
      const newBenefits = [...packageForm.benefits];
      newBenefits[paramsEditingIndex] = {
        ...newBenefits[paramsEditingIndex],
        params: nextParams,
      };
      setPackageForm((prev) => ({ ...prev, benefits: newBenefits }));
    }
    closeParamsModal();
  };

  return (
    <div className="admin-page-stack">
      {/* Cabeçalho unificado */}
      <section className="panel">
        <div
          className="inline-row"
          style={{ justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Gestão de Planos Premium</h2>
            {activePromotion ? (
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.75 }}>
                🎉 Promoção ativa: <strong>{activePromotion.name}</strong>
              </p>
            ) : null}
          </div>

          <div className="inline-row" style={{ gap: '8px', position: 'relative', alignItems: 'center' }} ref={addMenuRef}>
            <select
              value={targetGroup}
              onChange={(event) => setTargetGroup(event.target.value)}
              style={{ maxWidth: '160px' }}
            >
              {TARGET_GROUP_OPTIONS.map((group) => (
                <option key={group.value} value={group.value}>
                  {group.label}
                </option>
              ))}
            </select>

            <button type="button" className="btn btn--ghost" onClick={loadData} disabled={loading}>
              Atualizar
            </button>

            <button
              type="button"
              className="btn btn--primary"
              aria-label="Adicionar"
              title="Novo"
              onClick={() => setShowAddMenu((prev) => !prev)}
            >
              +
            </button>

            {showAddMenu ? (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'var(--color-surface, #1a1a2e)',
                  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
                  borderRadius: '8px',
                  padding: '6px 0',
                  minWidth: '180px',
                  zIndex: 100,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}
              >
                {[
                  { label: 'Nova promoção', modal: MODAL_PROMOTION },
                  { label: 'Novo pacote', modal: MODAL_PACKAGE },
                  { label: 'Novo benefício', modal: MODAL_BENEFIT },
                  { label: 'Novo cupom', modal: MODAL_COUPON },
                ].map((item) => (
                  <button
                    key={item.modal}
                    type="button"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 16px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                      fontSize: '0.95rem',
                    }}
                    onClick={() => {
                      if (item.modal === MODAL_PACKAGE) {
                        setPackageForm(makeEmptyPackageForm(targetGroup));
                      }
                      if (item.modal === MODAL_BENEFIT) {
                        setBenefitForm({ ...EMPTY_BENEFIT_FORM, targetGroup });
                      }
                      openModal(item.modal);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <AppNotice message={pageError} type="error" onClose={() => setPageError('')} />
        <AppNotice message={pageSuccess} type="success" onClose={() => setPageSuccess('')} autoHideMs={4000} />
      </section>

      {/* Abas */}
      <section className="panel" style={{ paddingBottom: 0 }}>
        <div className="inline-row" style={{ gap: 0, borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.12))', marginBottom: '-1px' }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--color-primary, #7c3aed)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--color-primary, #7c3aed)' : 'inherit',
                cursor: 'pointer',
                fontWeight: activeTab === tab.key ? 600 : 400,
                fontSize: '0.95rem',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ paddingTop: '16px' }}>
          {/* Aba Pacotes */}
          {activeTab === 'packages' ? (
            loading ? (
              <p>Carregando pacotes...</p>
            ) : !packages.length ? (
              <p>Nenhum pacote cadastrado para este grupo.</p>
            ) : (
              <ul className="simple-list">
                {packages.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      {item.isFree ? (
                        <span style={{ marginLeft: '8px', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                          GRATUITO
                        </span>
                      ) : null}
                      <p>{item.description || 'Sem descrição'}</p>
                      <p>
                        {item.isFree ? 'Grátis' : `Valor: ${(item.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                        {' | Duração: '}{item.durationDays} dia(s) | {item.active ? 'Ativo' : 'Inativo'}
                      </p>
                      {item.benefits && item.benefits.length ? (
                        <p style={{ fontSize: '0.82rem', opacity: 0.8 }}>
                          Benefícios: {item.benefits.map((b) => b.label || b.code).join(', ')}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={() => {
                        setEditingPackageId(item.id);
                        setPackageForm({
                          targetGroup: item.targetGroup || targetGroup,
                          title: item.title || '',
                          description: item.description || '',
                          benefits: normalizeBenefitsForForm(item.benefits),
                          isFree: Boolean(item.isFree),
                          priceCents: String(item.priceCents || ''),
                          durationDays: String(item.durationDays || ''),
                          displayOrder: String(item.displayOrder || 0),
                          promotionId: item.promotionId ? String(item.promotionId) : '',
                          active: Boolean(item.active),
                        });
                        openModal(MODAL_PACKAGE);
                      }}
                    >
                      Editar
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {/* Aba Benefícios (catálogo) */}
          {activeTab === 'benefits' ? (
            loading ? (
              <p>Carregando benefícios...</p>
            ) : !benefitCatalog.length ? (
              <p>Nenhum benefício cadastrado para este grupo.</p>
            ) : (
              <ul className="simple-list">
                {benefitCatalog.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.label}</strong>
                      <span style={{ marginLeft: '8px', fontSize: '0.72rem', fontFamily: 'monospace', opacity: 0.7 }}>
                        {item.code}
                      </span>
                      {item.enforced ? (
                        <span style={{ marginLeft: '8px', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                          APLICADO
                        </span>
                      ) : (
                        <span style={{ marginLeft: '8px', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>
                          CADASTRADO
                        </span>
                      )}
                      {!item.active ? (
                        <span style={{ marginLeft: '8px', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                          INATIVO
                        </span>
                      ) : null}
                      <p>{item.description || 'Sem descrição'}</p>
                      <p style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                        Grupo: {item.targetGroup === 'user' ? 'Usuários' : 'Estabelecimentos'}
                        {item.paramSchema && Object.keys(item.paramSchema).length
                          ? ` | Params: ${Object.keys(item.paramSchema).join(', ')}`
                          : ' | Sem parâmetros'}
                      </p>
                    </div>
                    <div className="inline-row" style={{ gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        onClick={() => {
                          setEditingBenefitId(item.id);
                          setBenefitForm({
                            code: item.code || '',
                            label: item.label || '',
                            description: item.description || '',
                            targetGroup: item.targetGroup || targetGroup,
                            paramSchema: formatParamSchemaText(item.paramSchema),
                            enforced: Boolean(item.enforced),
                            active: Boolean(item.active),
                          });
                          openModal(MODAL_BENEFIT);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        onClick={() => handleDeleteBenefit(item.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {/* Aba Promoções */}
          {activeTab === 'promotions' ? (
            loading ? (
              <p>Carregando promoções...</p>
            ) : !promotions.length ? (
              <p>Nenhuma promoção cadastrada para este grupo.</p>
            ) : (
              <ul className="simple-list">
                {promotions.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.description || 'Sem descrição'}</p>
                      <p>
                        Status: <strong>{item.status === 'active' ? 'Ativa' : item.status === 'scheduled' ? 'Agendada' : 'Encerrada'}</strong>
                        {item.startsAt ? ` | Início: ${new Date(item.startsAt).toLocaleString('pt-BR')}` : null}
                        {item.endsAt ? ` | Fim: ${new Date(item.endsAt).toLocaleString('pt-BR')}` : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={() => {
                        setEditingPromotionId(item.id);
                        setPromotionForm({
                          name: item.name || '',
                          description: item.description || '',
                          startsAt: toDatetimeLocalValue(item.startsAt),
                          endsAt: toDatetimeLocalValue(item.endsAt),
                        });
                        openModal(MODAL_PROMOTION);
                      }}
                    >
                      Editar
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {/* Aba Cupons */}
          {activeTab === 'coupons' ? (
            loading ? (
              <p>Carregando cupons...</p>
            ) : !coupons.length ? (
              <p>Nenhum cupom cadastrado para este grupo.</p>
            ) : (
              <ul className="simple-list">
                {coupons.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.code}</strong>
                      <p>{item.description || 'Sem descrição'}</p>
                      <p>
                        {item.discountType === 'percent' ? `${item.discountValue}% de desconto` : `R$ ${item.discountValue} de desconto`}
                        {item.usageLimit ? ` | Usos: ${item.usedCount ?? 0}/${item.usageLimit}` : null}
                        {' '}| {item.active ? 'Ativo' : 'Inativo'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={() => {
                        setEditingCouponId(item.id);
                        setCouponForm({
                          code: item.code || '',
                          description: item.description || '',
                          discountType: item.discountType || 'percent',
                          discountValue: String(item.discountValue || ''),
                          usageLimit: item.usageLimit ? String(item.usageLimit) : '',
                          validFrom: toDatetimeLocalValue(item.validFrom),
                          validUntil: toDatetimeLocalValue(item.validUntil),
                          active: Boolean(item.active),
                        });
                        openModal(MODAL_COUPON);
                      }}
                    >
                      Editar
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </section>

      {/* Modal: Promoção */}
      <Modal
        isOpen={activeModal === MODAL_PROMOTION}
        onClose={closeModal}
        title={editingPromotionId ? 'Editar promoção' : 'Nova promoção'}
        className="modal--wide"
      >
        <div style={{ minWidth: 'min(620px, 90vw)' }}>
          <AppNotice message={modalError} type="error" onClose={() => setModalError('')} />
          <form className="admin-form" onSubmit={handleSavePromotion}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <label>
                Grupo
                <input value={TARGET_GROUP_OPTIONS.find((g) => g.value === targetGroup)?.label ?? targetGroup} disabled />
              </label>
              <label>
                Nome
                <input
                  value={promotionForm.name}
                  onChange={(event) => setPromotionForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                Início
                <input
                  type="datetime-local"
                  value={promotionForm.startsAt}
                  onChange={(event) => setPromotionForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                  required
                />
              </label>
              <label>
                Fim (opcional)
                <input
                  type="datetime-local"
                  value={promotionForm.endsAt}
                  onChange={(event) => setPromotionForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Descrição
                <textarea
                  value={promotionForm.description}
                  onChange={(event) => setPromotionForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={2}
                />
              </label>
            </div>
            <div className="inline-row" style={{ marginTop: '16px' }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Salvando...' : editingPromotionId ? 'Salvar' : 'Criar promoção'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal: Pacote */}
      <Modal
        isOpen={activeModal === MODAL_PACKAGE && !paramsModalOpen}
        onClose={closeModal}
        title={editingPackageId ? 'Editar pacote' : 'Novo pacote'}
        className="modal--wide"
      >
        <div style={{ minWidth: 'min(720px, 90vw)' }}>
          <AppNotice message={modalError} type="error" onClose={() => setModalError('')} />
          <form className="admin-form" onSubmit={handleSavePackage}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <label>
                Grupo de usuários
                <select
                  value={packageForm.targetGroup}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, targetGroup: event.target.value }))}
                >
                  {TARGET_GROUP_OPTIONS.map((group) => (
                    <option key={group.value} value={group.value}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Promoção vinculada
                <select
                  value={packageForm.promotionId}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, promotionId: event.target.value }))}
                >
                  <option value="">Nenhuma (padrão)</option>
                  {promotions.map((promotion) => (
                    <option key={promotion.id} value={promotion.id}>
                      {promotion.name} ({promotion.status})
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Título
                <input
                  value={packageForm.title}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Descrição
                <textarea
                  value={packageForm.description}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={2}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Benefícios
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {packageForm.benefits.map((benefit, index) => {
                    const catalogEntry = catalogForGroup.find((c) => c.code === benefit.code);
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          padding: '10px',
                          border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select
                            value={benefit.code}
                            onChange={(event) => {
                              const nextCode = event.target.value;
                              const entry = catalogForGroup.find((c) => c.code === nextCode);
                              const newBenefits = [...packageForm.benefits];
                              newBenefits[index] = {
                                code: nextCode,
                                label: entry?.label || '',
                                params: defaultParamsFromSchema(entry?.paramSchema),
                              };
                              setPackageForm((prev) => ({ ...prev, benefits: newBenefits }));
                            }}
                            style={{ flex: '0 0 180px', maxWidth: '180px', fontSize: '0.82rem' }}
                          >
                            <option value="">Selecione...</option>
                            {catalogForGroup.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code}
                              </option>
                            ))}
                            {benefit.code === 'LEGACY' ? (
                              <option value="LEGACY">LEGACY</option>
                            ) : null}
                          </select>
                          <input
                            value={benefit.label}
                            onChange={(event) => {
                              const newBenefits = [...packageForm.benefits];
                              newBenefits[index] = { ...benefit, label: event.target.value };
                              setPackageForm((prev) => ({ ...prev, benefits: newBenefits }));
                            }}
                            placeholder="Descritivo do benefício"
                            style={{ flex: 1 }}
                          />
                          {packageForm.benefits.length > 1 ? (
                            <button
                              type="button"
                              className="btn btn--ghost btn--xs"
                              onClick={() => {
                                const newBenefits = packageForm.benefits.filter((_, i) => i !== index);
                                setPackageForm((prev) => ({
                                  ...prev,
                                  benefits: newBenefits.length ? newBenefits : [makeEmptyBenefitItem()],
                                }));
                              }}
                            >
                              ✕
                            </button>
                          ) : null}
                        </div>
                        {benefit.code && isDuplicateBenefitCode(packageForm.benefits, index) ? (
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#ef4444' }}>
                            Código "{benefit.code}" repetido em outro benefício deste pacote.
                          </p>
                        ) : null}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn btn--ghost btn--xs"
                            style={{ alignSelf: 'flex-start' }}
                            onClick={() => openParamsModal(index)}
                          >
                            Configurar parâmetros
                          </button>
                          <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.7 }}>
                            {summarizeParams(benefit.params)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() =>
                      setPackageForm((prev) => ({ ...prev, benefits: [...prev.benefits, makeEmptyBenefitItem()] }))
                    }
                  >
                    + Adicionar benefício
                  </button>
                </div>
              </label>
              <label>
                Preço (R$)
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={formatCurrencyDisplay(packageForm.priceCents)}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '');
                    setPackageForm((prev) => ({ ...prev, priceCents: digits }));
                  }}
                  required={!packageForm.isFree}
                  disabled={packageForm.isFree}
                />
              </label>
              <label>
                Duração (dias)
                <input
                  type="number"
                  min="1"
                  value={packageForm.durationDays}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, durationDays: event.target.value }))}
                  required={!packageForm.isFree}
                  disabled={packageForm.isFree}
                />
              </label>
              <label>
                Ordem de exibição
                <input
                  type="number"
                  min="0"
                  value={packageForm.displayOrder}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, displayOrder: event.target.value }))}
                />
              </label>
              <label className="admin-checkbox" style={{ alignSelf: 'end', paddingBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={packageForm.active}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, active: event.target.checked }))}
                />
                Pacote ativo
              </label>
              <label className="admin-checkbox" style={{ alignSelf: 'end', paddingBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={packageForm.isFree}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, isFree: event.target.checked }))}
                />
                Plano gratuito (padrão)
              </label>
            </div>
            <div className="inline-row" style={{ marginTop: '16px' }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Salvando...' : editingPackageId ? 'Salvar' : 'Criar pacote'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal: Cupom */}
      <Modal
        isOpen={activeModal === MODAL_COUPON}
        onClose={closeModal}
        title={editingCouponId ? 'Editar cupom' : 'Novo cupom'}
        className="modal--wide"
      >
        <div style={{ minWidth: 'min(720px, 90vw)' }}>
          <AppNotice message={modalError} type="error" onClose={() => setModalError('')} />
          <form className="admin-form" onSubmit={handleSaveCoupon}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <label>
                Grupo
                <input value={TARGET_GROUP_OPTIONS.find((g) => g.value === targetGroup)?.label ?? targetGroup} disabled />
              </label>
              <label>
                Código
                <input
                  value={couponForm.code}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  required
                />
              </label>
              <label>
                Tipo de desconto
                <select
                  value={couponForm.discountType}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, discountType: event.target.value }))}
                >
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </label>
              <label>
                Valor do desconto
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={couponForm.discountValue}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, discountValue: event.target.value }))}
                  required
                />
              </label>
              <label>
                Limite de usos
                <input
                  type="number"
                  min="1"
                  value={couponForm.usageLimit}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, usageLimit: event.target.value }))}
                />
              </label>
              <label className="admin-checkbox" style={{ alignSelf: 'end', paddingBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={couponForm.active}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, active: event.target.checked }))}
                />
                Cupom ativo
              </label>
              <label>
                Início de validade
                <input
                  type="datetime-local"
                  value={couponForm.validFrom}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, validFrom: event.target.value }))}
                />
              </label>
              <label>
                Fim de validade
                <input
                  type="datetime-local"
                  value={couponForm.validUntil}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, validUntil: event.target.value }))}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Descrição
                <textarea
                  value={couponForm.description}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={2}
                />
              </label>
            </div>
            <div className="inline-row" style={{ marginTop: '16px' }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Salvando...' : editingCouponId ? 'Salvar' : 'Criar cupom'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal: Benefício (catálogo) */}
      <Modal
        isOpen={activeModal === MODAL_BENEFIT}
        onClose={closeModal}
        title={editingBenefitId ? 'Editar benefício' : 'Novo benefício'}
        className="modal--wide"
      >
        <div style={{ minWidth: 'min(720px, 90vw)' }}>
          <AppNotice message={modalError} type="error" onClose={() => setModalError('')} />
          <form className="admin-form" onSubmit={handleSaveBenefit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <label>
                Código
                <input
                  value={benefitForm.code}
                  onChange={(event) =>
                    setBenefitForm((prev) => ({ ...prev, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))
                  }
                  placeholder="EX: FREE_MSG_NO_MATCH"
                  required
                  disabled={Boolean(editingBenefitId)}
                />
              </label>
              <label>
                Grupo
                <select
                  value={benefitForm.targetGroup}
                  onChange={(event) => setBenefitForm((prev) => ({ ...prev, targetGroup: event.target.value }))}
                  disabled={Boolean(editingBenefitId)}
                >
                  {TARGET_GROUP_OPTIONS.map((group) => (
                    <option key={group.value} value={group.value}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Rótulo (exibição)
                <input
                  value={benefitForm.label}
                  onChange={(event) => setBenefitForm((prev) => ({ ...prev, label: event.target.value }))}
                  required
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Descrição
                <textarea
                  value={benefitForm.description}
                  onChange={(event) => setBenefitForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={2}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                param_schema (JSON)
                <textarea
                  value={benefitForm.paramSchema}
                  onChange={(event) => setBenefitForm((prev) => ({ ...prev, paramSchema: event.target.value }))}
                  rows={6}
                  placeholder='{"dailyLimit":{"type":"number","min":0,"default":1}}'
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </label>
              <label className="admin-checkbox" style={{ alignSelf: 'end', paddingBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={benefitForm.enforced}
                  onChange={(event) => setBenefitForm((prev) => ({ ...prev, enforced: event.target.checked }))}
                />
                Aplicado (enforced)
              </label>
              <label className="admin-checkbox" style={{ alignSelf: 'end', paddingBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={benefitForm.active}
                  onChange={(event) => setBenefitForm((prev) => ({ ...prev, active: event.target.checked }))}
                />
                Ativo
              </label>
            </div>
            <p style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '8px' }}>
              "Aplicado (enforced)" só pode ser ativado se o backend já possui handler para o código.
              Codes sem handler ficam cadastrados e configuráveis, mas não destravam funcionalidade até deploy.
            </p>
            <div className="inline-row" style={{ marginTop: '16px' }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Salvando...' : editingBenefitId ? 'Salvar' : 'Criar benefício'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal: Parâmetros do benefício (pares chave-valor) */}
      <Modal
        isOpen={paramsModalOpen}
        onClose={closeParamsModal}
        title="Configurar parâmetros"
        className="modal--wide"
      >
        <div style={{ minWidth: 'min(560px, 90vw)' }}>
          <p style={{ fontSize: '0.82rem', opacity: 0.7, margin: '0 0 12px' }}>
            Informe os parâmetros adicionais do benefício como pares de item e valor.
            Valores numéricos e booleanos (true/false) são convertidos automaticamente.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {paramsDraft.map((pair, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  value={pair.key}
                  onChange={(event) => {
                    const next = [...paramsDraft];
                    next[index] = { ...pair, key: event.target.value };
                    setParamsDraft(next);
                  }}
                  placeholder="Item (ex: dailyLimit)"
                  style={{ flex: 1 }}
                />
                <input
                  value={pair.value}
                  onChange={(event) => {
                    const next = [...paramsDraft];
                    next[index] = { ...pair, value: event.target.value };
                    setParamsDraft(next);
                  }}
                  placeholder="Valor (ex: 1)"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() => {
                    const next = paramsDraft.filter((_, i) => i !== index);
                    setParamsDraft(next.length ? next : [{ key: '', value: '' }]);
                  }}
                  title="Excluir item"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setParamsDraft((prev) => [...prev, { key: '', value: '' }])}
            >
              + Adicionar item
            </button>
          </div>
          <div className="inline-row" style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn--primary" onClick={handleSaveParams}>
              Salvar parâmetros
            </button>
            <button type="button" className="btn btn--ghost" onClick={closeParamsModal}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
