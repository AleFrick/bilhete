import { useMemo, useState } from 'react';
import AppNotice from '../../components/AppNotice';

function formatStatus(status) {
  if (status === 'pending') {
    return 'Pendente';
  }
  if (status === 'approved') {
    return 'Aprovado';
  }
  if (status === 'rejected') {
    return 'Rejeitado';
  }
  return status || 'Desconhecido';
}

function parseDocuments(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

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

export default function AdminLinkRequestsPage({
  requests,
  loadingRequests,
  requestsError,
  requestsStatus,
  onChangeStatus,
  onRefresh,
  onUpdateVenueLinkApproval,
  loadingApproval,
}) {
  const [feedback, setFeedback] = useState('');

  const hasData = useMemo(() => Array.isArray(requests) && requests.length > 0, [requests]);

  const handleApproval = async (venueId, status) => {
    try {
      await onUpdateVenueLinkApproval(venueId, status);
      await onRefresh();
      setFeedback(status === 'approved' ? 'Pedido aprovado com sucesso.' : 'Pedido rejeitado com sucesso.');
    } catch {
      // Error handled by parent requestsError.
    }
  };

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
          <h2>Pedidos de vinculação</h2>
          <button type="button" className="btn btn--ghost" onClick={onRefresh} disabled={loadingRequests}>
            Atualizar
          </button>
        </div>

        <div className="inline-row" style={{ marginBottom: '12px' }}>
          <button
            type="button"
            className={`btn btn--ghost admin-status-filter ${requestsStatus === '' ? 'is-active' : ''}`}
            onClick={() => onChangeStatus('')}
          >
            Todos
          </button>
          <button
            type="button"
            className={`btn btn--ghost admin-status-filter admin-status-filter--pending ${requestsStatus === 'pending' ? 'is-active' : ''}`}
            onClick={() => onChangeStatus('pending')}
          >
            Pendentes
          </button>
          <button
            type="button"
            className={`btn btn--ghost admin-status-filter admin-status-filter--approved ${requestsStatus === 'approved' ? 'is-active' : ''}`}
            onClick={() => onChangeStatus('approved')}
          >
            Aprovados
          </button>
          <button
            type="button"
            className={`btn btn--ghost admin-status-filter admin-status-filter--rejected ${requestsStatus === 'rejected' ? 'is-active' : ''}`}
            onClick={() => onChangeStatus('rejected')}
          >
            Rejeitados
          </button>
        </div>

        <AppNotice message={requestsError} type="error" />

        {loadingRequests ? (
          <div className="admin-grid-loader" role="status" aria-live="polite" aria-label="Carregando pedidos">
            <span className="spinner" aria-hidden="true" />
          </div>
        ) : null}

        {!loadingRequests && !hasData ? <p>Nenhum pedido encontrado para este filtro.</p> : null}

        {!loadingRequests && hasData ? (
          <ul className="simple-list">
            {requests.map((item) => {
              const documents = parseDocuments(item.establishmentLinkDocuments);
              const isPending = item.establishmentLinkStatus === 'pending';

              return (
                <li key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.city || 'Cidade não informada'}</p>
                    <p>{item.address || 'Endereço não informado'}</p>
                    <p>
                      <strong>Estabelecimento:</strong> {item.establishmentName || 'Não identificado'}
                    </p>
                    <p>
                      <strong>Status:</strong>{' '}
                      <span className={`admin-link-status admin-link-status--${item.establishmentLinkStatus || 'unknown'}`}>
                        {formatStatus(item.establishmentLinkStatus)}
                      </span>
                    </p>
                    {item.establishmentLinkRequestedAt ? (
                      <p>
                        <strong>Solicitado em:</strong>{' '}
                        {new Date(item.establishmentLinkRequestedAt).toLocaleString('pt-BR')}
                      </p>
                    ) : null}
                    {item.establishmentLinkNote ? (
                      <p>
                        <strong>Texto da solicitação:</strong> {item.establishmentLinkNote}
                      </p>
                    ) : null}
                    {documents.length ? (
                      <div>
                        <strong>Documentos:</strong>
                        <div className="inline-row" style={{ marginTop: '6px', flexWrap: 'wrap' }}>
                          {documents.map((doc, index) => (
                            <a
                              key={`${item.id}-doc-${index}`}
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
                  </div>

                  <div className="inline-row">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--primary admin-link-request__action"
                          onClick={() => handleApproval(item.id, 'approved')}
                          disabled={loadingApproval}
                        >
                          <span aria-hidden="true">✓</span>
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost admin-link-request__action admin-link-request__action--reject"
                          onClick={() => handleApproval(item.id, 'rejected')}
                          disabled={loadingApproval}
                        >
                          <span aria-hidden="true">X</span>
                          Rejeitar
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
