import { useEffect, useState } from 'react';

import PremiumMarketplacePage from '../../components/PremiumMarketplacePage';
import AppNotice from '../../components/AppNotice';
import { adminApi } from '../api/adminClient';

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

const STATUS_LABELS = {
  pending: 'Pendente',
  paid: 'Pago',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS = {
  pending: '#f59e0b',
  paid: '#22c55e',
  expired: '#6b7280',
  cancelled: '#ef4444',
};

function PaymentHistoryTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.premiumCatalog();
      setOrders(data?.orders || []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleConfirm = async (orderId) => {
    setConfirmingId(orderId);
    setConfirmMsg('');
    setError('');
    try {
      await adminApi.premiumConfirmOrder(orderId);
      setConfirmMsg('Pagamento confirmado com sucesso! Seu plano premium foi ativado.');
      await loadOrders();
    } catch (err) {
      setError(err.message || 'Erro ao confirmar pagamento.');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="admin-page-stack">
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Histórico de Pagamentos</h2>

        <AppNotice message={confirmMsg} type="success" onClose={() => setConfirmMsg('')} />
        <AppNotice message={error} type="error" onClose={() => setError('')} />

        {loading ? (
          <p>Carregando...</p>
        ) : !orders.length ? (
          <p style={{ opacity: 0.6 }}>Nenhum pagamento registrado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {orders.map((order) => (
              <div
                key={order.id}
                className="panel"
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  borderLeft: `3px solid ${STATUS_COLORS[order.status] || '#666'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem' }}>{order.packageTitle || `Pedido #${order.id}`}</strong>
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: `${STATUS_COLORS[order.status] || '#666'}22`,
                        color: STATUS_COLORS[order.status] || '#666',
                      }}
                    >
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#e0264c' }}>
                      {formatMoney(order.finalPriceCents)}
                    </p>
                    {order.discountCents > 0 ? (
                      <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.5 }}>
                        de {formatMoney(order.basePriceCents)} | cupom: {order.couponCode || '-'}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', opacity: 0.7 }}>
                  <span><strong>Pedido:</strong> #{order.id}</span>
                  <span><strong>Proveedor:</strong> {order.paymentProvider || '-'}</span>
                  <span><strong>Criado em:</strong> {formatDateTime(order.createdAt)}</span>
                  {order.paidAt ? <span><strong>Pago em:</strong> {formatDateTime(order.paidAt)}</span> : null}
                  {order.paymentReference ? <span><strong>Ref:</strong> {order.paymentReference}</span> : null}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {order.status === 'pending' ? (
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{ padding: '6px 16px', fontSize: '0.82rem' }}
                      onClick={() => handleConfirm(order.id)}
                      disabled={confirmingId === order.id}
                    >
                      {confirmingId === order.id ? 'Confirmando...' : 'Confirmar pagamento'}
                    </button>
                  ) : null}
                  {order.paymentUrl ? (
                    <a
                      href={order.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--ghost"
                      style={{ padding: '6px 16px', fontSize: '0.82rem' }}
                    >
                      Ver link de pagamento
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function EstablishmentPremiumPage() {
  const [tab, setTab] = useState('plans');

  return (
    <div className="admin-page-stack">
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
        <button
          type="button"
          onClick={() => setTab('plans')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            color: tab === 'plans' ? '#e0264c' : 'inherit',
            fontWeight: tab === 'plans' ? 700 : 400,
            borderBottom: tab === 'plans' ? '2px solid #e0264c' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Planos
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            color: tab === 'history' ? '#e0264c' : 'inherit',
            fontWeight: tab === 'history' ? 700 : 400,
            borderBottom: tab === 'history' ? '2px solid #e0264c' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Histórico de Pagamentos
        </button>
      </div>

      {tab === 'plans' ? (
        <PremiumMarketplacePage apiClient={adminApi} title="Plano Premium do estabelecimento" />
      ) : (
        <PaymentHistoryTab />
      )}
    </div>
  );
}
