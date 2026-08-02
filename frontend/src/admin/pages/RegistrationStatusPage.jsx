import { useEffect, useRef, useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';

function formatStatusLabel(status) {
  if (status === 'pending') return 'Pendente';
  if (status === 'approved') return 'Aprovado';
  if (status === 'rejected') return 'Rejeitado';
  return status;
}

function statusColor(status) {
  if (status === 'approved') return '#16a34a';
  if (status === 'rejected') return '#dc2626';
  return '#eab308';
}

export default function RegistrationStatusPage({ onApproved }) {
  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const loadStatus = async () => {
    try {
      const data = await adminApi.getRegistrationStatus();
      setRequestData(data);
      if (data?.hasRequest && data?.request?.id) {
        const msgs = await adminApi.getRegistrationMessages(data.request.id);
        setMessages(msgs || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (requestData?.request?.status === 'approved' && onApproved) {
      onApproved();
    }
  }, [requestData]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!newMessage.trim() || !requestData?.request?.id) return;

    setSendingMessage(true);
    try {
      const msg = await adminApi.sendRegistrationMessage(requestData.request.id, newMessage.trim());
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <section className="panel">
        <p style={{ opacity: 0.6 }}>Carregando...</p>
      </section>
    );
  }

  if (!requestData?.hasRequest) {
    return null;
  }

  const request = requestData.request;

  return (
    <section className="panel">
      <h2 style={{ marginTop: 0 }}>Status do cadastro</h2>

      <AppNotice message={error} type="error" onClose={() => setError('')} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            className="pill"
            style={{
              background: statusColor(request.status),
              color: '#fff',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '0.82rem',
            }}
          >
            {formatStatusLabel(request.status)}
          </span>
          <span style={{ fontSize: '0.82rem', opacity: 0.6 }}>
            Enviado em {new Date(request.createdAt).toLocaleString('pt-BR')}
          </span>
        </div>

        <div style={{ fontSize: '0.88rem' }}>
          <p><strong>Estabelecimento:</strong> {request.establishmentName}</p>
          <p><strong>Email:</strong> {request.contactEmail}</p>
          {request.contactPhone ? <p><strong>Telefone:</strong> {request.contactPhone}</p> : null}
          {request.cnpj ? <p><strong>CNPJ:</strong> {request.cnpj}</p> : null}
          {request.description ? <p><strong>Descricao:</strong> {request.description}</p> : null}
        </div>

        {request.adminNote ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--line)',
              fontSize: '0.85rem',
            }}
          >
            <strong>Nota do administrador:</strong>
            <p style={{ margin: '4px 0 0' }}>{request.adminNote}</p>
          </div>
        ) : null}

        {request.status === 'rejected' ? (
          <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>
            Seu pedido foi rejeitado. Se desejar, voce pode entrar em contato via chat abaixo para mais informacoes.
          </p>
        ) : null}

        {request.status === 'approved' ? (
          <p style={{ color: '#16a34a', fontSize: '0.85rem' }}>
            Seu cadastro foi aprovado! Voce ja pode acessar todas as funcionalidades do painel.
          </p>
        ) : null}
      </div>

      {request.status === 'pending' ? (
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Conversa com o administrador</h3>
          <div
            style={{
              maxHeight: '320px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--line)',
              marginBottom: '12px',
            }}
          >
            {messages.length === 0 ? (
              <p style={{ opacity: 0.5, fontSize: '0.82rem', textAlign: 'center' }}>
                Nenhuma mensagem ainda. Use o campo abaixo para conversar com o administrador.
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.senderRole === 'establishment' ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '12px',
                      background: msg.senderRole === 'establishment' ? 'var(--accent, #ff2d55)' : 'rgba(255,255,255,0.1)',
                      color: msg.senderRole === 'establishment' ? '#fff' : 'var(--text)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {msg.message}
                  </div>
                  <span style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '2px', display: 'block' }}>
                    {new Date(msg.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.88rem',
              }}
            />
            <button type="submit" className="btn btn--primary" disabled={sendingMessage || !newMessage.trim()}>
              {sendingMessage ? '...' : 'Enviar'}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
