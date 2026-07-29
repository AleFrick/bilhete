import { useEffect, useMemo, useState } from 'react';

import AppNotice from './AppNotice';
import PageLoader from './PageLoader';

function formatMoney(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

const PAYMENT_METHODS = [
  { value: 'PIX', label: 'Pix', icon: '⚡', description: 'Pagamento instantâneo' },
  { value: 'BOLETO', label: 'Boleto', icon: '🎫', description: 'Vence em 24h' },
  { value: 'CREDIT_CARD', label: 'Cartão de Crédito', icon: '💳', description: 'Parcelamento disponível' },
];

export default function PremiumMarketplacePage({ apiClient }) {
  const [step, setStep] = useState('catalog'); // 'catalog' | 'checkout'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [catalog, setCatalog] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [billingType, setBillingType] = useState('PIX');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentUrl, setPaymentUrl] = useState(null);

  const storeAvailable = catalog?.storeAvailable ?? false;
  const paymentProvider = catalog?.paymentProvider ?? null;

  /* packageId do plano atual — usa o pedido pago mais recente */
  const currentPackageId = useMemo(() => {
    if (!catalog?.activeSubscription) return null;
    const paidOrder = catalog?.orders?.find((o) => o.status === 'paid');
    return paidOrder?.packageId ?? null;
  }, [catalog]);

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.premiumCatalog();
      setCatalog(data);
    } catch (requestError) {
      setError(requestError.message || 'Erro ao carregar catálogo premium.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
    setCouponCode('');
    setCheckoutError('');
    setPaymentUrl(null);
    setBillingType('PIX');
    setStep('checkout');
  };

  const handleBack = () => {
    setStep('catalog');
    setSelectedPackage(null);
    setCouponCode('');
    setCheckoutError('');
    setPaymentUrl(null);
  };

  const handleCheckout = async () => {
    if (!selectedPackage) return;
    setCheckoutLoading(true);
    setCheckoutError('');
    setSuccess('');
    setPaymentUrl(null);
    try {
      const data = await apiClient.premiumCheckout({
        packageId: selectedPackage.id,
        couponCode: couponCode.trim() || undefined,
        billingType: paymentProvider === 'asaas' ? billingType : undefined,
      });

      if (data?.order?.paymentUrl && paymentProvider === 'asaas') {
        setPaymentUrl(data.order.paymentUrl);
      }

      setSuccess(
        `Pedido criado! Valor final: ${formatMoney(data?.order?.finalPriceCents)}. ` +
          (paymentProvider === 'asaas'
            ? 'Aguarde a confirmação do pagamento.'
            : 'Confirme o pagamento no seu perfil em Premium.')
      );
      setStep('catalog');
      setSelectedPackage(null);
      setCouponCode('');
      await loadCatalog();
    } catch (requestError) {
      setCheckoutError(requestError.message || 'Erro ao iniciar checkout premium.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  /* ─── CHECKOUT ─────────────────────────────────────────────── */
  if (step === 'checkout' && selectedPackage) {
    return (
      <div className="admin-page-stack">
        {/* Barra superior */}
        <section className="panel">
          <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn--ghost" onClick={handleBack} disabled={checkoutLoading}>
              ← Voltar
            </button>
            <h2 style={{ margin: 0 }}>Finalizar pedido</h2>
            <button type="button" className="btn btn--ghost" onClick={handleBack} disabled={checkoutLoading}>
              Cancelar
            </button>
          </div>
        </section>

        {/* Resumo do pacote */}
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>{selectedPackage.title}</h3>
          {selectedPackage.description ? <p>{selectedPackage.description}</p> : null}
          <div className="inline-row" style={{ gap: '24px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span>
              <strong>Duração:</strong> {selectedPackage.durationDays} dia(s)
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary, #7c3aed)' }}>
              {formatMoney(selectedPackage.priceCents)}
            </span>
          </div>
        </section>

        {/* Forma de pagamento (apenas Asaas) */}
        {paymentProvider === 'asaas' ? (
          <section className="panel">
            <h3 style={{ marginTop: 0 }}>Forma de pagamento</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px',
                marginTop: '12px',
              }}
            >
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setBillingType(method.value)}
                  disabled={checkoutLoading}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '4px',
                    padding: '16px',
                    borderRadius: '10px',
                    border:
                      billingType === method.value
                        ? '2px solid var(--color-primary, #7c3aed)'
                        : '1px solid var(--color-border, rgba(255,255,255,0.12))',
                    background:
                      billingType === method.value
                        ? 'rgba(124,58,237,0.08)'
                        : 'var(--color-surface-raised, rgba(255,255,255,0.04))',
                    cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{method.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{method.label}</span>
                  <span style={{ fontSize: '0.78rem', opacity: 0.6 }}>{method.description}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Cupom + ação */}
        <section className="panel">
          <AppNotice message={checkoutError} type="error" onClose={() => setCheckoutError('')} />
          <label>
            Cupom de desconto (opcional)
            <input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
              placeholder="Ex: PROMO10"
              maxLength={40}
              disabled={checkoutLoading}
            />
          </label>
          <div className="inline-row" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading
                ? 'Processando...'
                : paymentProvider === 'asaas'
                  ? `Pagar com ${PAYMENT_METHODS.find((m) => m.value === billingType)?.label || 'Asaas'}`
                  : 'Finalizar pedido'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleBack}
              disabled={checkoutLoading}
            >
              Cancelar
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ─── CATÁLOGO ──────────────────────────────────────────────── */
  return (
    <div className="admin-page-stack">
      {/* Avisos globais */}
      <AppNotice message={error} type="error" onClose={() => setError('')} />
      <AppNotice message={success} type="success" onClose={() => setSuccess('')} autoHideMs={5000} />

      {/* Aviso de loja indisponível */}
      {!loading && catalog && !storeAvailable ? (
        <section className="panel" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(234,179,8,0.12)',
              border: '1px solid rgba(234,179,8,0.3)',
            }}
          >
            ⚠️ <strong>Vendas temporariamente indisponíveis.</strong> Os pacotes premium serão exibidos quando o pagamento estiver configurado.
          </div>
        </section>
      ) : null}

      {/* Promoção ativa e status */}
      {(catalog?.activePromotion || catalog?.activeSubscription) ? (
        <section className="panel" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
          {catalog.activePromotion ? (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.3)',
                marginBottom: catalog.activeSubscription ? '8px' : 0,
              }}
            >
              🎉 <strong>Promoção:</strong> {catalog.activePromotion.name}
              {catalog.activePromotion.endsAt ? ` — até ${formatDateTime(catalog.activePromotion.endsAt)}` : null}
            </div>
          ) : null}
          {catalog.activeSubscription ? (
            <p style={{ margin: 0, fontSize: '0.88rem' }}>
              ✦ <strong>Assinatura ativa até:</strong> {formatDateTime(catalog.activeSubscription.endsAt)}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Grid de pacotes */}
      <section className="panel">
        {loading ? <PageLoader label="Carregando pacotes..." /> : null}

        {!loading && !catalog?.packages?.length ? (
          <p>Nenhum pacote disponível no momento.</p>
        ) : null}

        {!loading && catalog?.packages?.length ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '16px',
              marginTop: '8px',
            }}
          >
            {catalog.packages.map((pkg) => {
              const isCurrent = currentPackageId === pkg.id;
              return (
                <div
                  key={pkg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '20px',
                    borderRadius: '12px',
                    border: isCurrent
                      ? '2px solid var(--color-primary, #7c3aed)'
                      : '1px solid var(--color-border, rgba(255,255,255,0.12))',
                    background: 'var(--color-surface-raised, rgba(255,255,255,0.04))',
                    position: 'relative',
                    minHeight: '180px',
                    opacity: storeAvailable ? 1 : 0.5,
                  }}
                >
                  {/* Badge plano atual */}
                  {isCurrent ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--color-primary, #7c3aed)',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 12px',
                        borderRadius: '999px',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.04em',
                      }}
                    >
                      PLANO ATUAL
                    </span>
                  ) : null}

                  <div>
                    <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '1.05rem' }}>
                      {pkg.title}
                    </p>
                    {pkg.description ? (
                      <p
                        style={{
                          margin: '0 0 12px',
                          fontSize: '0.88rem',
                          opacity: 0.75,
                          lineHeight: 1.45,
                        }}
                      >
                        {pkg.description}
                      </p>
                    ) : null}
                    <p style={{ margin: '0 0 4px', fontSize: '0.85rem', opacity: 0.65 }}>
                      {pkg.durationDays} dia(s)
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        color: 'var(--color-primary, #7c3aed)',
                      }}
                    >
                      {formatMoney(pkg.priceCents)}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={isCurrent ? 'btn btn--ghost' : 'btn btn--primary'}
                    style={{ marginTop: '16px', width: '100%' }}
                    onClick={() => handleSelectPackage(pkg)}
                    disabled={!storeAvailable}
                  >
                    {isCurrent ? 'Renovar' : 'Escolher'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
