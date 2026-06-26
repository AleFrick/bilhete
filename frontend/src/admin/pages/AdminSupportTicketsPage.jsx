import { useEffect, useMemo, useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';
import Modal from '../../components/Modal';
import SupportTicketDetailModal from '../components/SupportTicketDetailModal';

const STATUS_LABELS = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Encerrado',
};

function formatStatus(status) {
  return STATUS_LABELS[status] || status || 'Desconhecido';
}

function normalizeDateToInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [filters, setFilters] = useState({
    openedDate: '',
    searchText: '',
    status: '',
    sortDirection: 'desc',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    openedDate: '',
    searchText: '',
    status: '',
    sortDirection: 'desc',
  });

  const [loadingTickets, setLoadingTickets] = useState(false);
  const [savingTicketId, setSavingTicketId] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailTab, setDetailTab] = useState('details');
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState('');

  const [ticketMessages, setTicketMessages] = useState([]);
  const [loadingTicketMessages, setLoadingTicketMessages] = useState(false);
  const [sendingTicketMessage, setSendingTicketMessage] = useState(false);
  const [ticketMessageDraft, setTicketMessageDraft] = useState('');
  const [ticketMessageError, setTicketMessageError] = useState('');

  const hasTickets = useMemo(() => Array.isArray(tickets) && tickets.length > 0, [tickets]);

  const filteredTickets = useMemo(() => {
    const searchText = String(appliedFilters.searchText || '').trim().toLowerCase();

    const result = tickets.filter((ticket) => {
      if (appliedFilters.status && ticket.status !== appliedFilters.status) {
        return false;
      }

      if (appliedFilters.openedDate) {
        const openedDate = normalizeDateToInputValue(ticket.createdAt);
        if (openedDate !== appliedFilters.openedDate) {
          return false;
        }
      }

      if (searchText) {
        const subject = String(ticket.subject || '').toLowerCase();
        const message = String(ticket.message || '').toLowerCase();
        const establishmentName = String(ticket.establishmentName || '').toLowerCase();
        if (!subject.includes(searchText) && !message.includes(searchText) && !establishmentName.includes(searchText)) {
          return false;
        }
      }

      return true;
    });

    const direction = appliedFilters.sortDirection === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return (dateA - dateB) * direction;
    });

    return result;
  }, [tickets, appliedFilters]);

  const hasFilteredTickets = filteredTickets.length > 0;

  const loadTickets = async () => {
    setLoadingTickets(true);
    setError('');

    try {
      const data = await adminApi.adminSupportTickets();
      setTickets(data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSearchTickets = async (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
    await loadTickets();
  };

  const handleSaveStatus = async (ticketId, status) => {
    setSavingTicketId(ticketId);
    setError('');
    setFeedback('');

    try {
      const updated = await adminApi.updateAdminSupportTicket(ticketId, { status });
      setTickets((prev) => prev.map((item) => (item.id === ticketId ? { ...item, ...updated } : item)));
      setSelectedTicket((prev) => (prev && prev.id === ticketId ? { ...prev, ...updated } : prev));
      setFeedback('Chamado atualizado com sucesso.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingTicketId(null);
    }
  };

  const loadTicketMessages = async (ticketId) => {
    setLoadingTicketMessages(true);
    setTicketMessageError('');

    try {
      const messages = await adminApi.adminSupportTicketMessages(ticketId);
      setTicketMessages(messages || []);
    } catch (requestError) {
      setTicketMessageError(requestError.message);
    } finally {
      setLoadingTicketMessages(false);
    }
  };

  const handleOpenTicketDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setDetailTab('details');
    setTicketMessageDraft('');
    await loadTicketMessages(ticket.id);
  };

  const handleSendTicketMessage = async (event) => {
    event.preventDefault();
    if (!selectedTicket || selectedTicket.status === 'resolved') {
      return;
    }

    setSendingTicketMessage(true);
    setTicketMessageError('');

    try {
      const isFirstAdminReply =
        selectedTicket.status === 'open' && !ticketMessages.some((item) => item.senderRole === 'admin');

      await adminApi.createAdminSupportTicketMessage(selectedTicket.id, {
        message: ticketMessageDraft,
      });

      if (isFirstAdminReply) {
        const updatedTicket = await adminApi.updateAdminSupportTicket(selectedTicket.id, { status: 'in_progress' });
        setTickets((prev) => prev.map((item) => (item.id === selectedTicket.id ? { ...item, ...updatedTicket } : item)));
        setSelectedTicket((prev) => (prev && prev.id === selectedTicket.id ? { ...prev, ...updatedTicket } : prev));
      }

      setTicketMessageDraft('');
      await loadTicketMessages(selectedTicket.id);
    } catch (requestError) {
      setTicketMessageError(requestError.message);
    } finally {
      setSendingTicketMessage(false);
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
          <h2>Chamados dos estabelecimentos</h2>
        </div>

        <form className="support-ticket-filters" onSubmit={handleSearchTickets}>
          <div className="support-ticket-filters__fields">
            <label>
              Data de abertura
              <input
                type="date"
                value={filters.openedDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, openedDate: event.target.value }))}
              />
            </label>
            <label>
              Buscar por texto
              <input
                value={filters.searchText}
                onChange={(event) => setFilters((prev) => ({ ...prev, searchText: event.target.value }))}
                placeholder="Titulo, descricao ou estabelecimento"
              />
            </label>
            <label>
              Ordenar por data
              <select
                value={filters.sortDirection}
                onChange={(event) => setFilters((prev) => ({ ...prev, sortDirection: event.target.value }))}
              >
                <option value="desc">Mais recentes primeiro</option>
                <option value="asc">Mais antigos primeiro</option>
              </select>
            </label>
          </div>

          <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="inline-row">
              <button
                type="button"
                className={`btn btn--ghost admin-status-filter ${filters.status === '' ? 'is-active' : ''}`}
                onClick={() => setFilters((prev) => ({ ...prev, status: '' }))}
              >
                Todos
              </button>
              <button
                type="button"
                className={`btn btn--ghost admin-status-filter admin-status-filter--pending ${filters.status === 'open' ? 'is-active' : ''}`}
                onClick={() => setFilters((prev) => ({ ...prev, status: 'open' }))}
              >
                Abertos
              </button>
              <button
                type="button"
                className={`btn btn--ghost admin-status-filter ${filters.status === 'in_progress' ? 'is-active' : ''}`}
                onClick={() => setFilters((prev) => ({ ...prev, status: 'in_progress' }))}
              >
                Em andamento
              </button>
              <button
                type="button"
                className={`btn btn--ghost admin-status-filter admin-status-filter--approved ${filters.status === 'resolved' ? 'is-active' : ''}`}
                onClick={() => setFilters((prev) => ({ ...prev, status: 'resolved' }))}
              >
                Encerrados
              </button>
            </div>

            <button type="submit" className="btn btn--ghost" disabled={loadingTickets}>
              Buscar
            </button>
          </div>
        </form>

        <AppNotice message={error} type="error" />
        {loadingTickets ? <p>Carregando chamados...</p> : null}
        {!loadingTickets && !hasTickets ? <p>Nenhum chamado encontrado.</p> : null}
        {!loadingTickets && hasTickets && !hasFilteredTickets ? <p>Nenhum chamado encontrado para os filtros selecionados.</p> : null}

        {!loadingTickets && hasFilteredTickets ? (
          <ul className="simple-list support-ticket-list">
            {filteredTickets.map((ticket) => (
              <li key={ticket.id} className="support-ticket-item support-ticket-item--history">
                <button
                  type="button"
                  className="support-ticket-history__trigger"
                  onClick={() => handleOpenTicketDetails(ticket)}
                >
                  <div className="support-ticket-item__content">
                    <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{ticket.subject}</strong>
                      <span className={`pill support-ticket-status support-ticket-status--${ticket.status}`}>
                        {formatStatus(ticket.status)}
                      </span>
                    </div>
                    <p>
                      <strong>Estabelecimento:</strong> {ticket.establishmentName || 'Nao identificado'}
                    </p>
                    <p>
                      <strong>Aberto em:</strong> {new Date(ticket.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <SupportTicketDetailModal
        isOpen={Boolean(selectedTicket)}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket ? `Chamado #${selectedTicket.id}` : 'Detalhes do chamado'}
        ticket={selectedTicket}
        detailTab={detailTab}
        onDetailTabChange={setDetailTab}
        headerActions={
          selectedTicket ? (
            <div className="support-ticket-modal-actions">
              <span className={`pill support-ticket-status support-ticket-status--${selectedTicket.status}`}>
                {formatStatus(selectedTicket.status)}
              </span>

              {selectedTicket.status === 'resolved' ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--compact"
                  onClick={() => handleSaveStatus(selectedTicket.id, 'in_progress')}
                  disabled={savingTicketId === selectedTicket.id}
                >
                  Reabrir
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary btn--compact"
                  onClick={() => handleSaveStatus(selectedTicket.id, 'resolved')}
                  disabled={savingTicketId === selectedTicket.id}
                >
                  Encerrar
                </button>
              )}
            </div>
          ) : null
        }
        detailsMeta={[
          { label: 'Estabelecimento', value: selectedTicket?.establishmentName || 'Nao identificado' },
          {
            label: 'Contato',
            value: selectedTicket?.establishmentEmail || selectedTicket?.ownerEmail || 'Nao informado',
          },
          {
            label: 'Aberto em',
            value: selectedTicket ? new Date(selectedTicket.createdAt).toLocaleString('pt-BR') : '',
          },
        ]}
        attachmentUrls={selectedTicket?.attachmentUrls}
        onPreviewAttachment={setPreviewAttachmentUrl}
        ticketMessages={ticketMessages}
        loadingTicketMessages={loadingTicketMessages}
        ticketMessageError={ticketMessageError}
        emptyChatText="Nenhuma mensagem neste chamado ainda."
        outgoingRole="admin"
        mapSenderLabel={(senderRole) => (senderRole === 'admin' ? 'Admin' : 'Estabelecimento')}
        ticketMessageDraft={ticketMessageDraft}
        onTicketMessageDraftChange={setTicketMessageDraft}
        onSendTicketMessage={handleSendTicketMessage}
        messagePlaceholder={selectedTicket?.status === 'resolved' ? 'Chamado encerrado.' : 'Escreva uma resposta...'}
        isMessageDisabled={selectedTicket?.status === 'resolved'}
        sendingTicketMessage={sendingTicketMessage}
      />

      <Modal isOpen={Boolean(previewAttachmentUrl)} onClose={() => setPreviewAttachmentUrl('')} title="Preview da imagem">
        <div className="support-ticket-preview">
          <img src={previewAttachmentUrl} alt="Preview do anexo" />
        </div>
      </Modal>
    </div>
  );
}
