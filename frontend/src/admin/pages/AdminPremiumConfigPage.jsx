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
  { key: 'promotions', label: 'Promoções' },
  { key: 'coupons', label: 'Cupons' },
];

const MODAL_NONE = null;
const MODAL_PACKAGE = 'package';
const MODAL_COUPON = 'coupon';
const MODAL_PROMOTION = 'promotion';

const makeEmptyPackageForm = (targetGroup) => ({
  targetGroup,
  title: '',
  description: '',
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

export default function AdminPremiumConfigPage() {
  const [targetGroup, setTargetGroup] = useState('user');
  const [activeTab, setActiveTab] = useState('packages');
  const [packages, setPackages] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [promotions, setPromotions] = useState([]);
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

  const activePromotion = useMemo(() => promotions.find((item) => item.status === 'active') || null, [promotions]);

  const loadData = async () => {
    setLoading(true);
    setPageError('');
    try {
      const [packagesData, couponsData, promotionsData] = await Promise.all([
        adminApi.adminPremiumPackages({ targetGroup }),
        adminApi.adminPremiumCoupons({ targetGroup }),
        adminApi.adminPremiumPromotions({ targetGroup }),
      ]);
      setPackages(packagesData || []);
      setCoupons(couponsData || []);
      setPromotions(promotionsData || []);
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
  };

  const handleSavePackage = async (event) => {
    event.preventDefault();
    setSaving(true);
    setModalError('');
    setPageSuccess('');
    try {
      const payload = {
        targetGroup: packageForm.targetGroup,
        title: packageForm.title,
        description: packageForm.description,
        priceCents: Number(packageForm.priceCents || 0),
        durationDays: Number(packageForm.durationDays),
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
                      <p>{item.description || 'Sem descrição'}</p>
                      <p>
                        Valor: {(item.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{' '}
                        | Duração: {item.durationDays} dia(s) | {item.active ? 'Ativo' : 'Inativo'}
                      </p>
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
      >
        <div style={{ minWidth: 'min(580px, 90vw)' }}>
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
        isOpen={activeModal === MODAL_PACKAGE}
        onClose={closeModal}
        title={editingPackageId ? 'Editar pacote' : 'Novo pacote'}
      >
        <div style={{ minWidth: 'min(620px, 90vw)' }}>
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
                  required
                />
              </label>
              <label>
                Duração (dias)
                <input
                  type="number"
                  min="1"
                  value={packageForm.durationDays}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, durationDays: event.target.value }))}
                  required
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
      >
        <div style={{ minWidth: 'min(620px, 90vw)' }}>
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
    </div>
  );
}
