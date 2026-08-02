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

export default function AdminRegistrationRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');
  const messagesEndRef = useRef(null);

  const loadRequests = async (status = statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.adminRegistrationRequests({ status });
      setRequests(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadMessages = async (requestId) => {
    try {
      const data = await adminApi.getRegistrationMessages(requestId);
      setMessages(data || []);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
    setReviewNote('');
    setLocalError('');
    setLocalSuccess('');
    setMessages([]);
    if (request.status === 'pending') {
      loadMessages(request.id);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!newMessage.trim() || !selectedRequest?.id) return;

    setSendingMessage(true);
    try {
      const msg = await adminApi.sendRegistrationMessage(selectedRequest.id, newMessage.trim());
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReview = async (status) => {
    if (!selectedRequest?.id) return;

    setReviewing(true);
    setLocalError('');
    setLocalSuccess('');
    try {
      await adminApi.adminReviewRegistration(selectedRequest.id, {
        status,
        adminNote: reviewNote.trim(),
      });
      setLocalSuccess(`Pedido ${status === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso.`);
      await loadRequests(statusFilter);
      setSelectedRequest(null);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setReviewing(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '0.85rem',
  };

  return (
    <div>
      <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Pedidos de cadastro de estabelecimento</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              type="button"
              className={`btn ${statusFilter === status ? 'btn--primary' : 'btn--ghost'}`}
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              onClick={() => setStatusFilter(status)}
            >
              {formatStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      <AppNotice message={error} type="error" onClose={() => setError('')} />

      {loading ? (
        <p style={{ opacity: 0.6 }}>Carregando...</p>
      ) : requests.length === 0 ? (
        <p style={{ opacity: 0.6 }}>Nenhum pedido {formatStatusLabel(statusFilter).toLowerCase()}.</p>
      ) : (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', maxWidth: '380px' }}>
            <ul className="simple-list">
              {requests.map((req) => (
                <li
                  key={req.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: selectedRequest?.id === req.id ? '2px solid var(--accent, #ff2d55)' : '1px solid var(--line)',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    background: 'var(--surface)',
                  }}
                  onClick={() => handleSelectRequest(req)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{req.establishmentName}</strong>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: statusColor(req.status),
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    >
                      {formatStatusLabel(req.status)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', opacity: 0.6, margin: '4px 0 0' }}>
                    {req.contactEmail} · {new Date(req.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {selectedRequest ? (
            <div style={{ flex: '1 1 400px' }}>
              <AppNotice message={localError} type="error" onClose={() => setLocalError('')} />
              <AppNotice message={localSuccess} type="success" onClose={() => setLocalSuccess('')} />

              <section className="panel">
                <h3 style={{ marginTop: 0 }}>{selectedRequest.establishmentName}</h3>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                  <p><strong>Email:</strong> {selectedRequest.contactEmail}</p>
                  {selectedRequest.contactPhone ? <p><strong>Telefone:</strong> {selectedRequest.contactPhone}</p> : null}
                  {selectedRequest.cnpj ? <p><strong>CNPJ:</strong> {selectedRequest.cnpj}</p> : null}
                  {selectedRequest.description ? <p><strong>Descricao:</strong> {selectedRequest.description}</p> : null}
                  <p><strong>Solicitado em:</strong> {new Date(selectedRequest.createdAt).toLocaleString('pt-BR')}</p>
                  {selectedRequest.adminNote ? <p><strong>Nota admin:</strong> {selectedRequest.adminNote}</p> : null}
                </div>

                {selectedRequest.status === 'pending' ? (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Conversa</h4>
                      <div
                        style={{
                          maxHeight: '240px',
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--line)',
                          marginBottom: '8px',
                        }}
                      >
                        {messages.length === 0 ? (
                          <p style={{ opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>Sem mensagens.</p>
                        ) : (
                          messages.map((msg) => (
                            <div
                              key={msg.id}
                              style={{
                                alignSelf: msg.senderRole === 'admin' ? 'flex-end' : 'flex-start',
                                maxWidth: '75%',
                              }}
                            >
                              <div
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '10px',
                                  background: msg.senderRole === 'admin' ? 'var(--accent, #ff2d55)' : 'rgba(255,255,255,0.1)',
                                  color: msg.senderRole === 'admin' ? '#fff' : 'var(--text)',
                                  fontSize: '0.82rem',
                                }}
                              >
                                {msg.message}
                              </div>
                              <span style={{ fontSize: '0.68rem', opacity: 0.4 }}>
                                {new Date(msg.createdAt).toLocaleString('pt-BR')}
                              </span>
                            </div>
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Mensagem..."
                          style={inputStyle}
                        />
                        <button type="submit" className="btn btn--ghost" disabled={sendingMessage || !newMessage.trim()}>
                          {sendingMessage ? '...' : 'Enviar'}
                        </button>
                      </form>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                        Nota (opcional)
                      </label>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        rows={2}
                        placeholder="Comentario sobre a decisao..."
                        style={{ ...inputStyle, resize: 'vertical', marginBottom: '12px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={reviewing}
                          onClick={() => handleReview('approved')}
                        >
                          {reviewing ? '...' : 'Aprovar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={reviewing}
                          onClick={() => handleReview('rejected')}
                        >
                          {reviewing ? '...' : 'Rejeitar'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                    Pedido {formatStatusLabel(selectedRequest.status).toLowerCase()} em{' '}
                    {selectedRequest.reviewedAt ? new Date(selectedRequest.reviewedAt).toLocaleString('pt-BR') : 'n/a'}.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
