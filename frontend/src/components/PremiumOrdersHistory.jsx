import { useEffect, useState } from 'react';

import AppNotice from './AppNotice';
import PageLoader from './PageLoader';

function formatMoney(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

const ORDER_STATUS_LABEL = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

export default function PremiumOrdersHistory({ apiClient }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [catalog, setCatalog] = useState(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.premiumCatalog();
      setCatalog(data);
    } catch (requestError) {
      setError(requestError.message || 'Erro ao carregar dados premium.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleConfirmPayment = async (orderId) => {
    setConfirmingOrderId(orderId);
    setError('');
    setSuccess('');
    try {
      await apiClient.premiumConfirmOrder(orderId);
      setSuccess('Pagamento confirmado e assinatura premium ativada!');
      await loadCatalog();
    } catch (requestError) {
      setError(requestError.message || 'Erro ao confirmar pagamento.');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  return (
    <div>
      <AppNotice message={error} type="error" onClose={() => setError('')} />
      <AppNotice message={success} type="success" onClose={() => setSuccess('')} autoHideMs={5000} />

      {/* Status da assinatura */}
      {catalog?.activeSubscription ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(248,219,123,0.10)',
            border: '1px solid rgba(248,219,123,0.3)',
            marginBottom: '16px',
          }}
        >
          ✦ <strong>Assinatura ativa até:</strong> {formatDateTime(catalog.activeSubscription.endsAt)}
        </div>
      ) : null}

      {/* Pedidos */}
      <h4 style={{ margin: '0 0 10px' }}>Histórico de pedidos</h4>

      {loading ? (
        <PageLoader label="Carregando assinatura..." />
      ) : !catalog?.orders?.length ? (
        <p style={{ opacity: 0.6 }}>Nenhum pedido registrado.</p>
      ) : (
        <ul className="simple-list">
          {catalog.orders.map((order) => (
            <li key={order.id}>
              <div>
                <strong>{order.packageTitle}</strong>
                <p>
                  {ORDER_STATUS_LABEL[order.status] ?? order.status} &mdash;{' '}
                  {formatMoney(order.finalPriceCents)}
                  {order.couponCode ? ` (cupom: ${order.couponCode})` : null}
                </p>
              </div>
              {order.status === 'pending' ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => handleConfirmPayment(order.id)}
                  disabled={confirmingOrderId === order.id}
                >
                  {confirmingOrderId === order.id ? 'Confirmando...' : 'Confirmar pagamento'}
                </button>
              ) : (
                <span className="pill">{ORDER_STATUS_LABEL[order.status] ?? order.status}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
