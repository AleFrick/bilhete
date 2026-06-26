import Modal from '../../components/Modal';
import AppNotice from '../../components/AppNotice';

export default function SupportTicketDetailModal({
  isOpen,
  onClose,
  title,
  ticket,
  detailTab,
  onDetailTabChange,
  headerActions,
  detailsMeta,
  attachmentUrls,
  onPreviewAttachment,
  ticketMessages,
  loadingTicketMessages,
  ticketMessageError,
  emptyChatText,
  outgoingRole,
  mapSenderLabel,
  ticketMessageDraft,
  onTicketMessageDraftChange,
  onSendTicketMessage,
  messagePlaceholder,
  isMessageDisabled,
  sendingTicketMessage,
  descriptionLabel = 'Descricao',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className="support-ticket-detail-modal"
      headerActions={headerActions}
    >
      {ticket ? (
        <div className="support-ticket-detail">
          <div className="support-ticket-detail__panel">
            <div className="inline-row" style={{ gap: '8px' }}>
              <button
                type="button"
                className={`btn btn--ghost ${detailTab === 'details' ? 'is-active' : ''}`}
                onClick={() => onDetailTabChange('details')}
              >
                Detalhes
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${detailTab === 'chat' ? 'is-active' : ''}`}
                onClick={() => onDetailTabChange('chat')}
              >
                Chat
              </button>
            </div>

            {detailTab === 'details' ? (
              <>
                <strong>{ticket.subject}</strong>

                {detailsMeta.map((item) => (
                  <p key={item.label}>
                    <strong>{item.label}:</strong> {item.value}
                  </p>
                ))}

                <div className="support-ticket-detail__section">
                  <strong>{descriptionLabel}</strong>
                  <div className="support-ticket-detail__message">{ticket.message}</div>
                </div>

                {Array.isArray(attachmentUrls) && attachmentUrls.length ? (
                  <div className="support-ticket-detail__section">
                    <strong>Anexos</strong>
                    <div className="support-ticket-attachments__list">
                      {attachmentUrls.map((url, index) => (
                        <button
                          key={`${ticket.id}-preview-${index}`}
                          type="button"
                          className="support-ticket-attachment-preview-btn"
                          onClick={() => onPreviewAttachment(url)}
                          aria-label={`Previsualizar anexo ${index + 1}`}
                          title="Previsualizar anexo"
                        >
                          <img src={url} alt={`Anexo ${index + 1} do chamado ${ticket.id}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="support-ticket-chat__panel">
                <div className="support-ticket-chat">
                  <AppNotice message={ticketMessageError} type="error" />
                  {loadingTicketMessages ? <p>Carregando mensagens...</p> : null}

                  {!loadingTicketMessages ? (
                    <div className="support-ticket-chat__list">
                      {ticketMessages.length ? (
                        ticketMessages.map((item) => {
                          const outgoing = item.senderRole === outgoingRole;
                          return (
                            <div
                              key={item.id}
                              className={`support-ticket-chat__item support-ticket-chat__item--${item.senderRole} ${
                                outgoing ? 'support-ticket-chat__item--outgoing' : 'support-ticket-chat__item--incoming'
                              }`}
                            >
                              <div className="support-ticket-chat__meta">
                                <strong>{mapSenderLabel(item.senderRole)}</strong>
                                <time>{new Date(item.createdAt).toLocaleString('pt-BR')}</time>
                              </div>
                              <p>{item.message}</p>
                            </div>
                          );
                        })
                      ) : (
                        <p>{emptyChatText}</p>
                      )}
                    </div>
                  ) : null}

                  <form className="support-ticket-chat__form" onSubmit={onSendTicketMessage}>
                    <textarea
                      rows={2}
                      value={ticketMessageDraft}
                      onChange={(event) => onTicketMessageDraftChange(event.target.value)}
                      placeholder={messagePlaceholder}
                      disabled={isMessageDisabled || sendingTicketMessage}
                      required
                    />
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={isMessageDisabled || sendingTicketMessage || !String(ticketMessageDraft || '').trim()}
                    >
                      {sendingTicketMessage ? 'Enviando...' : 'Enviar mensagem'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
