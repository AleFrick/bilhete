import { useEffect, useMemo, useRef, useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';
import Modal from '../../components/Modal';
import SupportTicketDetailModal from '../components/SupportTicketDetailModal';

const STATUS_LABELS = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Encerrado',
};

const MAX_ATTACHMENTS = 5;

function formatStatus(status) {
  return STATUS_LABELS[status] || status || 'Desconhecido';
}

export default function EstablishmentSupportTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailTab, setDetailTab] = useState('details');
  const [ticketMessages, setTicketMessages] = useState([]);
  const [loadingTicketMessages, setLoadingTicketMessages] = useState(false);
  const [sendingTicketMessage, setSendingTicketMessage] = useState(false);
  const [ticketMessageDraft, setTicketMessageDraft] = useState('');
  const [ticketMessageError, setTicketMessageError] = useState('');
  const [processingAttachments, setProcessingAttachments] = useState(false);
  const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState('');
  const [form, setForm] = useState({ subject: '', message: '', attachments: [] });
  const [filters, setFilters] = useState({ openedDate: '', searchText: '', status: '' });
  const [appliedFilters, setAppliedFilters] = useState({ openedDate: '', searchText: '', status: '' });
  const attachmentFileInputRef = useRef(null);

  const hasTickets = useMemo(() => Array.isArray(tickets) && tickets.length > 0, [tickets]);

  const normalizeDateToInputValue = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filteredTickets = useMemo(() => {
    const searchText = String(appliedFilters.searchText || '').trim().toLowerCase();

    return tickets.filter((ticket) => {
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
        if (!subject.includes(searchText) && !message.includes(searchText)) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, appliedFilters]);

  const hasFilteredTickets = filteredTickets.length > 0;

  const loadTickets = async () => {
    setLoadingTickets(true);
    setLoadingError('');

    try {
      const data = await adminApi.establishmentSupportTickets();
      setTickets(data || []);
    } catch (requestError) {
      setLoadingError(requestError.message);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem selecionada.'));
      reader.readAsDataURL(file);
    });

  const resizeDataUrlImage = (dataUrl, maxSide = 1200, quality = 0.82) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const longestSide = Math.max(image.width, image.height);
        const ratio = longestSide > maxSide ? maxSide / longestSide : 1;
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Nao foi possivel processar a imagem.'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.onerror = () => reject(new Error('Falha ao carregar imagem selecionada.'));
      image.src = dataUrl;
    });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setFeedback('');

    try {
      await adminApi.createEstablishmentSupportTicket(form);
      setForm({ subject: '', message: '', attachments: [] });
      setFeedback('Chamado enviado com sucesso.');
      await loadTickets();
      setIsCreateModalOpen(false);
    } catch (requestError) {
      setSubmitError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCreateModal = () => {
    setSubmitError('');
    setFeedback('');
    setIsCreateModalOpen(true);
  };

  const loadSelectedTicketMessages = async (ticketId) => {
    setLoadingTicketMessages(true);
    setTicketMessageError('');

    try {
      const messages = await adminApi.establishmentSupportTicketMessages(ticketId);
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
    await loadSelectedTicketMessages(ticket.id);
  };

  const handleSendTicketMessage = async (event) => {
    event.preventDefault();
    if (!selectedTicket || selectedTicket.status === 'resolved') {
      return;
    }

    setSendingTicketMessage(true);
    setTicketMessageError('');

    try {
      await adminApi.createEstablishmentSupportTicketMessage(selectedTicket.id, {
        message: ticketMessageDraft,
      });
      setTicketMessageDraft('');
      await loadSelectedTicketMessages(selectedTicket.id);
      await loadTickets();
    } catch (requestError) {
      setTicketMessageError(requestError.message);
    } finally {
      setSendingTicketMessage(false);
    }
  };

  const handleSearchTickets = async (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
    await loadTickets();
  };

  const handleOpenAttachmentPicker = () => {
    attachmentFileInputRef.current?.click();
  };

  const processAttachmentFiles = async (inputFiles) => {
    const files = Array.from(inputFiles || []);

    if (!files.length) {
      return;
    }

    if (form.attachments.length >= MAX_ATTACHMENTS) {
      setSubmitError(`Limite de ${MAX_ATTACHMENTS} imagens por chamado.`);
      return;
    }

    setProcessingAttachments(true);
    setSubmitError('');

    try {
      const nextAttachments = [...form.attachments];
      const availableSlots = Math.max(0, MAX_ATTACHMENTS - nextAttachments.length);

      for (const file of files.slice(0, availableSlots)) {
        if (!String(file.type || '').startsWith('image/')) {
          continue;
        }

        const rawDataUrl = await fileToDataUrl(file);
        const optimizedDataUrl = await resizeDataUrlImage(rawDataUrl);
        nextAttachments.push(optimizedDataUrl);
      }

      if (nextAttachments.length === form.attachments.length) {
        setSubmitError('Selecione ao menos uma imagem valida para anexar.');
        return;
      }

      setForm((prev) => ({ ...prev, attachments: nextAttachments }));
    } catch {
      setSubmitError('Nao foi possivel processar as imagens selecionadas.');
    } finally {
      setProcessingAttachments(false);
      setIsDraggingAttachment(false);
    }
  };

  const handleAttachmentFileChange = async (event) => {
    const files = event.target.files;
    event.target.value = '';
    await processAttachmentFiles(files);
  };

  const handleAttachmentDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await processAttachmentFiles(event.dataTransfer?.files);
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, index) => index !== indexToRemove),
    }));
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
          <h2 className="support-ticket-title">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h4v2h8v-2h4c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 12H4V7h16v10Zm-9-1h2v-2h2v-2h-2v-2h-2v2H9v2h2v2Z" />
            </svg>
            Histórico de chamados
          </h2>
          <div className="inline-row">
            <button type="button" className="btn btn--primary support-ticket-create-btn" onClick={handleOpenCreateModal}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 16H5V5h14v14ZM13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7Z" />
              </svg>
              Criar novo chamado
            </button>
          </div>
        </div>
        <p className="auth-subtitle">Acompanhe aqui os chamados enviados.</p>

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
                placeholder="Titulo ou descricao"
              />
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
                Resolvidos
              </button>
            </div>

            <button type="submit" className="btn btn--ghost" disabled={loadingTickets}>
              Buscar
            </button>
          </div>
        </form>

        <AppNotice message={loadingError} type="error" />

        {loadingTickets ? <p>Carregando chamados...</p> : null}
        {!loadingTickets && !hasTickets ? <p>Nenhum chamado enviado até o momento.</p> : null}
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
                      <strong>Aberto em:</strong> {new Date(ticket.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Criar novo chamado"
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Assunto
            <input
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              maxLength={160}
              required
            />
          </label>

          <label>
            Mensagem
            <textarea
              className="support-ticket-message-textarea"
              rows={5}
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              maxLength={4000}
              required
            />
          </label>

          <div className="support-ticket-upload">
            <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Anexar imagens</strong>
              <button
                type="button"
                className="admin-icon-btn support-ticket-upload__add"
                onClick={handleOpenAttachmentPicker}
                disabled={processingAttachments || form.attachments.length >= MAX_ATTACHMENTS}
                aria-label="Adicionar imagem"
                title="Adicionar imagem"
              >
                +
              </button>
            </div>
            <input
              ref={attachmentFileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="visually-hidden"
              onChange={handleAttachmentFileChange}
            />

            <div
              className={`support-ticket-upload__dropzone ${isDraggingAttachment ? 'is-dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDraggingAttachment(true);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDraggingAttachment(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (event.currentTarget === event.target) {
                  setIsDraggingAttachment(false);
                }
              }}
              onDrop={handleAttachmentDrop}
            >
              {processingAttachments ? 'Processando imagens...' : 'Arraste imagens aqui'}
            </div>

            {form.attachments.length ? (
              <ul className="support-ticket-attachments__compact-list">
                {form.attachments.map((url, index) => (
                  <li key={`new-ticket-attachment-${index}`} className="support-ticket-attachments__compact-item">
                    <img src={url} alt={`Imagem anexada ${index + 1}`} className="support-ticket-attachments__compact-thumb" />
                    <span className="support-ticket-attachments__compact-label">Imagem {index + 1}</span>
                    <div className="inline-row" style={{ marginLeft: 'auto' }}>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => setPreviewAttachmentUrl(url)}
                        aria-label={`Previsualizar imagem ${index + 1}`}
                        title="Previsualizar"
                      >
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M12 5c5.5 0 9.5 4.5 10.8 6.2.3.4.3 1 0 1.4C21.5 14.3 17.5 18.8 12 18.8S2.5 14.3 1.2 12.6a1.1 1.1 0 0 1 0-1.4C2.5 9.5 6.5 5 12 5Zm0 2c-4 0-7.1 3.1-8.6 5 1.5 1.9 4.6 5 8.6 5s7.1-3.1 8.6-5c-1.5-1.9-4.6-5-8.6-5Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn admin-icon-btn--danger"
                        onClick={() => handleRemoveAttachment(index)}
                        aria-label={`Remover imagem ${index + 1}`}
                        title="Remover imagem"
                      >
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M6 7h12v2H6V7Zm2 3h2v8H8v-8Zm6 0h2v8h-2v-8ZM9 4h6l1 1h4v2H4V5h4l1-1Z" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <AppNotice message={submitError} type="error" />

          <div className="inline-row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost" onClick={() => setIsCreateModalOpen(false)} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(previewAttachmentUrl)} onClose={() => setPreviewAttachmentUrl('')} title="Preview da imagem">
        <div className="support-ticket-preview">
          <img src={previewAttachmentUrl} alt="Preview do anexo" />
        </div>
      </Modal>

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
            </div>
          ) : null
        }
        detailsMeta={[
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
        emptyChatText="Nenhuma mensagem no chat deste chamado."
        outgoingRole="establishment"
        mapSenderLabel={(senderRole) => (senderRole === 'admin' ? 'Admin' : 'Voce')}
        ticketMessageDraft={ticketMessageDraft}
        onTicketMessageDraftChange={setTicketMessageDraft}
        onSendTicketMessage={handleSendTicketMessage}
        messagePlaceholder={
          selectedTicket?.status === 'resolved'
            ? 'Chamado encerrado pelo admin.'
            : 'Escreva sua mensagem sobre o chamado...'
        }
        isMessageDisabled={selectedTicket?.status === 'resolved'}
        sendingTicketMessage={sendingTicketMessage}
      />
    </div>
  );
}
