import { useEffect, useRef, useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';
import { formatStatusLabel } from '../utils/statusLabel';

function parseDocuments(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function statusColor(status) {
  if (status === 'approved') return '#16a34a';
  if (status === 'rejected') return '#dc2626';
  return '#eab308';
}

function normalizeStatus(status) {
  if (status === 'approved' || status === 'rejected') return status;
  if (status === 'pending') return 'pending';
  return 'pending';
}

export default function AdminRequestsPage({
  linkRequests,
  loadingLinkRequests,
  linkRequestsError,
  linkRequestsStatus,
  onChangeLinkRequestsStatus,
  onRefreshLinkRequests,
  onUpdateVenueLinkApproval,
  loadingApproval,
}) {
  const [typeFilter, setTypeFilter] = useState('all'); // all | link | registration
  const [regStatusFilter, setRegStatusFilter] = useState('pending');
  const [regRequests, setRegRequests] = useState([]);
  const [loadingRegRequests, setLoadingRegRequests] = useState(false);
  const [regError, setRegError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');
  const [feedback, setFeedback] = useState('');
  const messagesEndRef = useRef(null);

  const loadRegRequests = async (status = regStatusFilter) => {
    setLoadingRegRequests(true);
    setRegError('');
    try {
      const data = await adminApi.adminRegistrationRequests({ status });
      setRegRequests(data || []);
    } catch (err) {
      setRegError(err.message);
    } finally {
      setLoadingRegRequests(false);
    }
  };

  useEffect(() => {
    if (typeFilter === 'all' || typeFilter === 'registration') {
      loadRegRequests();
    }
  }, [regStatusFilter, typeFilter]);

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

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setReviewNote('');
    setLocalError('');
    setLocalSuccess('');
    setMessages([]);
    if (item.type === 'registration' && item.status === 'pending') {
      loadMessages(item.id);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!newMessage.trim() || !selectedItem?.id) return;

    setSendingMessage(true);
    try {
      const msg = await adminApi.sendRegistrationMessage(selectedItem.id, newMessage.trim());
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReviewRegistration = async (status) => {
    if (!selectedItem?.id) return;

    setReviewing(true);
    setLocalError('');
    setLocalSuccess('');
    try {
      await adminApi.adminReviewRegistration(selectedItem.id, {
        status,
        adminNote: reviewNote.trim(),
      });
      setLocalSuccess(`Pedido ${status === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso.`);
      await loadRegRequests();
      setSelectedItem(null);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setReviewing(false);
    }
  };

  const handleLinkApproval = async (venueId, status) => {
    try {
      await onUpdateVenueLinkApproval(venueId, status);
      await onRefreshLinkRequests();
      setFeedback(status === 'approved' ? 'Pedido aprovado com sucesso.' : 'Pedido rejeitado com sucesso.');
      setSelectedItem(null);
    } catch {
      // Error handled by parent
    }
  };

  const normalizedLinkRequests = (linkRequests || []).map((item) => ({
    ...item,
    type: 'link',
    status: normalizeStatus(item.establishmentLinkStatus),
    displayName: item.name || 'Local sem nome',
    subtitle: `${item.city || 'Cidade nao informada'} · ${item.address || 'Sem endereco'}`,
    establishment: item.establishmentName || 'Nao identificado',
    createdAt: item.establishmentLinkRequestedAt || null,
    note: item.establishmentLinkNote || '',
    documents: parseDocuments(item.establishmentLinkDocuments),
  }));

  const normalizedRegRequests = regRequests.map((item) => ({
    ...item,
    type: 'registration',
    status: item.status,
    displayName: item.establishmentName,
    subtitle: `${item.contactEmail}${item.cnpj ? ' · CNPJ: ' + item.cnpj : ''}`,
    establishment: item.establishmentName,
    createdAt: item.createdAt,
    note: item.adminNote || '',
    documents: [],
  }));

  const allItems = [...normalizedLinkRequests, ...normalizedRegRequests].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const filteredItems = allItems.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    return true;
  });

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '0.85rem',
  };

  const filterBtnStyle = (active) => ({
    fontSize: '0.82rem',
    padding: '6px 14px',
    className: active ? 'btn btn--primary' : 'btn btn--ghost',
  });

  return (
    <div className="admin-page-stack">
      <AppNotice
        message={feedback}
        type="success"
        floating
        autoHideMs={3500}
        onClose={() => setFeedback('')}
      />

      <section className="panel">
        <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Pedidos</h2>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              onRefreshLinkRequests();
              loadRegRequests();
            }}
            disabled={loadingLinkRequests || loadingRegRequests}
          >
            Atualizar
          </button>
        </div>

        <div className="inline-row" style={{ marginBottom: '8px', marginTop: '12px' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '4px' }}>Tipo:</span>
          <button
            type="button"
            className={`btn btn--ghost ${typeFilter === 'all' ? 'is-active' : ''}`}
            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            onClick={() => setTypeFilter('all')}
          >
            Todos
          </button>
          <button
            type="button"
            className={`btn btn--ghost ${typeFilter === 'link' ? 'is-active' : ''}`}
            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            onClick={() => setTypeFilter('link')}
          >
            Vinculacao
          </button>
          <button
            type="button"
            className={`btn btn--ghost ${typeFilter === 'registration' ? 'is-active' : ''}`}
            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            onClick={() => setTypeFilter('registration')}
          >
            Cadastro
          </button>
        </div>

        <div className="inline-row" style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '4px' }}>Status:</span>
          {typeFilter === 'link' || typeFilter === 'all' ? (
            <>
              <button
                type="button"
                className={`btn btn--ghost ${linkRequestsStatus === '' ? 'is-active' : ''}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => onChangeLinkRequestsStatus('')}
              >
                Todos
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${linkRequestsStatus === 'pending' ? 'is-active' : ''}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => onChangeLinkRequestsStatus('pending')}
              >
                Pendentes
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${linkRequestsStatus === 'approved' ? 'is-active' : ''}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => onChangeLinkRequestsStatus('approved')}
              >
                Aprovados
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${linkRequestsStatus === 'rejected' ? 'is-active' : ''}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => onChangeLinkRequestsStatus('rejected')}
              >
                Rejeitados
              </button>
            </>
          ) : null}
          {typeFilter === 'registration' ? (
            <>
              <button
                type="button"
                className={`btn btn--ghost ${regStatusFilter === 'pending' ? 'is-active' : ''}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => setRegStatusFilter('pending')}
              >
                Pendentes
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${regStatusFilter === 'approved' ? 'is-active' : ''}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => setRegStatusFilter('approved')}
              >
                Aprovados
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${regStatusFilter === 'rejected' ? 'is-active' : ''}`}
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => setRegStatusFilter('rejected')}
              >
                Rejeitados
              </button>
            </>
          ) : null}
        </div>

        <AppNotice message={linkRequestsError || regError} type="error" />

        {loadingLinkRequests || loadingRegRequests ? (
          <div className="admin-grid-loader" role="status" aria-live="polite" aria-label="Carregando pedidos">
            <span className="spinner" aria-hidden="true" />
          </div>
        ) : null}

        {!loadingLinkRequests && !loadingRegRequests && filteredItems.length === 0 ? (
          <p>Nenhum pedido encontrado para este filtro.</p>
        ) : null}

        {!loadingLinkRequests && !loadingRegRequests && filteredItems.length > 0 ? (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', maxWidth: '380px' }}>
              <ul className="simple-list">
                {filteredItems.map((item) => (
                  <li
                    key={`${item.type}-${item.id}`}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: selectedItem?.id === item.id && selectedItem?.type === item.type ? '2px solid var(--accent, #ff2d55)' : '1px solid var(--line)',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      background: 'var(--surface)',
                    }}
                    onClick={() => handleSelectItem(item)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.88rem' }}>{item.displayName}</strong>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: item.type === 'link' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)',
                            color: item.type === 'link' ? '#60a5fa' : '#c084fc',
                            fontWeight: 600,
                          }}
                        >
                          {item.type === 'link' ? 'Vinculacao' : 'Cadastro'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: statusColor(item.status),
                            color: '#fff',
                            fontWeight: 600,
                          }}
                        >
                          {formatStatusLabel(item.status)}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.78rem', opacity: 0.6, margin: '4px 0 0' }}>
                      {item.subtitle}
                    </p>
                    {item.createdAt ? (
                      <p style={{ fontSize: '0.72rem', opacity: 0.4, margin: '2px 0 0' }}>
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            {selectedItem ? (
              <div style={{ flex: '1 1 400px' }}>
                <AppNotice message={localError} type="error" onClose={() => setLocalError('')} />
                <AppNotice message={localSuccess} type="success" onClose={() => setLocalSuccess('')} />

                <section className="panel">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: selectedItem.type === 'link' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)',
                        color: selectedItem.type === 'link' ? '#60a5fa' : '#c084fc',
                        fontWeight: 600,
                      }}
                    >
                      {selectedItem.type === 'link' ? 'Vinculacao' : 'Cadastro'}
                    </span>
                    <h3 style={{ margin: 0 }}>{selectedItem.displayName}</h3>
                  </div>

                  <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                    {selectedItem.type === 'link' ? (
                      <>
                        <p><strong>Local:</strong> {selectedItem.name}</p>
                        <p><strong>Cidade:</strong> {selectedItem.city || 'Nao informada'}</p>
                        <p><strong>Endereco:</strong> {selectedItem.address || 'Nao informado'}</p>
                        <p><strong>Estabelecimento:</strong> {selectedItem.establishment}</p>
                        {selectedItem.note ? <p><strong>Texto da solicitacao:</strong> {selectedItem.note}</p> : null}
                        {selectedItem.documents.length > 0 ? (
                          <div>
                            <strong>Documentos:</strong>
                            <div className="inline-row" style={{ marginTop: '6px', flexWrap: 'wrap' }}>
                              {selectedItem.documents.map((doc, index) => (
                                <a
                                  key={`doc-${index}`}
                                  href={doc}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn--ghost"
                                >
                                  Documento {index + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p><strong>Estabelecimento:</strong> {selectedItem.establishmentName}</p>
                        <p><strong>Email:</strong> {selectedItem.contactEmail}</p>
                        {selectedItem.contactPhone ? <p><strong>Telefone:</strong> {selectedItem.contactPhone}</p> : null}
                        {selectedItem.cnpj ? <p><strong>CNPJ:</strong> {selectedItem.cnpj}</p> : null}
                        {selectedItem.description ? <p><strong>Descricao:</strong> {selectedItem.description}</p> : null}
                        {selectedItem.note ? <p><strong>Nota admin:</strong> {selectedItem.note}</p> : null}
                      </>
                    )}
                    {selectedItem.createdAt ? (
                      <p><strong>Solicitado em:</strong> {new Date(selectedItem.createdAt).toLocaleString('pt-BR')}</p>
                    ) : null}
                  </div>

                  {selectedItem.status === 'pending' ? (
                    <>
                      {selectedItem.type === 'registration' ? (
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
                      ) : null}

                      {selectedItem.type === 'registration' ? (
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
                        </div>
                      ) : null}

                      <div className="inline-row">
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={reviewing || loadingApproval}
                          onClick={() =>
                            selectedItem.type === 'link'
                              ? handleLinkApproval(selectedItem.id, 'approved')
                              : handleReviewRegistration('approved')
                          }
                        >
                          <span aria-hidden="true">✓</span> Aprovar
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={reviewing || loadingApproval}
                          onClick={() =>
                            selectedItem.type === 'link'
                              ? handleLinkApproval(selectedItem.id, 'rejected')
                              : handleReviewRegistration('rejected')
                          }
                        >
                          <span aria-hidden="true">X</span> Rejeitar
                        </button>
                      </div>
                    </>
                  ) : (
                    <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                      Pedido {formatStatusLabel(selectedItem.status).toLowerCase()}.
                    </p>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
