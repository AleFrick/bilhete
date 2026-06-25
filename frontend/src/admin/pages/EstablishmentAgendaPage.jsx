import { useEffect, useMemo, useRef, useState } from 'react';

import { adminApi } from '../api/adminClient';

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatMonthLabel(year, month) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatBrazilDate(value) {
  if (!value) {
    return '';
  }

  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatEventTime(value) {
  const normalized = String(value || '').slice(0, 5);
  if (!normalized) {
    return '--:--';
  }

  return normalized;
}

function parseMetadataPairs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const pairs = Object.entries(value)
    .map(([key, entryValue]) => ({
      key: String(key || ''),
      value: String(entryValue || ''),
    }))
    .filter((entry) => entry.key || entry.value);

  if (!pairs.length) {
    return [];
  }

  return pairs;
}

function countFilledMetadata(pairs) {
  if (!Array.isArray(pairs)) {
    return 0;
  }

  return pairs.filter((entry) => String(entry.key || '').trim() && String(entry.value || '').trim()).length;
}

function buildMetadataPayload(pairs) {
  if (!Array.isArray(pairs)) {
    return {};
  }

  return pairs
    .map((entry) => ({
      key: String(entry.key || '').trim(),
      value: String(entry.value || '').trim(),
    }))
    .filter((entry) => entry.key && entry.value)
    .slice(0, 40)
    .reduce((accumulator, entry) => {
      accumulator[entry.key] = entry.value;
      return accumulator;
    }, {});
}

function buildCalendarCells(year, month) {
  const firstDayWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayWeek; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  return cells;
}

export default function EstablishmentAgendaPage({ hasApprovedLink }) {
  const flyerFileInputRef = useRef(null);

  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = formatMonthLabel(year, month);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flyerLoadError, setFlyerLoadError] = useState(false);
  const [flyerPreviewOpen, setFlyerPreviewOpen] = useState(false);
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [metadataDraftRows, setMetadataDraftRows] = useState([]);
  const [metadataInputKey, setMetadataInputKey] = useState('');
  const [metadataInputValue, setMetadataInputValue] = useState('');
  const [metadataEditingIndex, setMetadataEditingIndex] = useState(null);
  const [form, setForm] = useState({
    partyFlyerUrl: '',
    title: '',
    information: '',
    startTime: '',
    metadataPairs: [],
  });

  const metadataCount = useMemo(() => countFilledMetadata(form.metadataPairs), [form.metadataPairs]);

  const readImageAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
      reader.readAsDataURL(file);
    });

  const eventsByDay = useMemo(() => {
    const grouped = new Map();
    for (const event of events) {
      const eventDate = String(event.eventDate || '').slice(0, 10);
      if (!eventDate) {
        continue;
      }

      if (!grouped.has(eventDate)) {
        grouped.set(eventDate, []);
      }

      grouped.get(eventDate).push(event);
    }

    for (const [key, list] of grouped.entries()) {
      list.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
      grouped.set(key, list);
    }

    return grouped;
  }, [events]);

  const calendarCells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const loadAgenda = async () => {
    if (!hasApprovedLink) {
      setEvents([]);
      return;
    }

    setLoadingEvents(true);
    setError('');

    try {
      const data = await adminApi.establishmentAgenda({ year, month });
      setEvents(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    loadAgenda();
  }, [hasApprovedLink]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timer = setTimeout(() => setFeedback(''), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const openModalForDay = (day) => {
    const dateValue = `${year}-${pad(month)}-${pad(day)}`;
    setEditingEventId(null);
    setSelectedDate(dateValue);
    setForm({
      partyFlyerUrl: '',
      title: '',
      information: '',
      startTime: '',
      metadataPairs: [],
    });
    setFlyerLoadError(false);
    setFlyerPreviewOpen(false);
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEventId(null);
    setSelectedDate('');
    setFlyerPreviewOpen(false);
    setMetadataModalOpen(false);
  };

  const openModalForEvent = (agendaEvent) => {
    setEditingEventId(agendaEvent.id);
    setSelectedDate(String(agendaEvent.eventDate || '').slice(0, 10));
    setForm({
      partyFlyerUrl: agendaEvent.partyFlyerUrl || '',
      title: agendaEvent.title || '',
      information: agendaEvent.information || '',
      startTime: String(agendaEvent.startTime || '').slice(0, 5),
      metadataPairs: parseMetadataPairs(agendaEvent.analyticsMetadata),
    });
    setFlyerLoadError(false);
    setFlyerPreviewOpen(false);
    setError('');
    setModalOpen(true);
  };

  const handleOpenFlyerPicker = () => {
    flyerFileInputRef.current?.click();
  };

  const handleFlyerFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!String(file.type || '').startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido para o folder.');
      return;
    }

    setError('');
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setForm((prev) => ({ ...prev, partyFlyerUrl: dataUrl }));
      setFlyerLoadError(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleRemoveFlyer = () => {
    setForm((prev) => ({ ...prev, partyFlyerUrl: '' }));
    setFlyerLoadError(false);
    setFlyerPreviewOpen(false);
  };

  const openMetadataModal = () => {
    setMetadataDraftRows(parseMetadataPairs(buildMetadataPayload(form.metadataPairs)));
    setMetadataInputKey('');
    setMetadataInputValue('');
    setMetadataEditingIndex(null);
    setMetadataModalOpen(true);
  };

  const closeMetadataModal = () => {
    setMetadataModalOpen(false);
    setMetadataInputKey('');
    setMetadataInputValue('');
    setMetadataEditingIndex(null);
  };

  const handleSelectMetadataRow = (index) => {
    const row = metadataDraftRows[index];
    if (!row) {
      return;
    }

    setMetadataEditingIndex(index);
    setMetadataInputKey(row.key);
    setMetadataInputValue(row.value);
  };

  const handleApplyMetadataInput = () => {
    const key = metadataInputKey.trim();
    const value = metadataInputValue.trim();

    if (!key || !value) {
      setError('Preencha campo e valor para salvar dado estatístico.');
      return;
    }

    setError('');
    setMetadataDraftRows((prev) => {
      if (metadataEditingIndex !== null && prev[metadataEditingIndex]) {
        return prev.map((row, index) => (index === metadataEditingIndex ? { key, value } : row));
      }

      return [...prev, { key, value }].slice(0, 40);
    });

    setMetadataEditingIndex(null);
    setMetadataInputKey('');
    setMetadataInputValue('');
  };

  const handleRemoveMetadataDraft = (index, domEvent) => {
    if (domEvent) {
      domEvent.preventDefault();
      domEvent.stopPropagation();
    }

    setMetadataDraftRows((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

    if (metadataEditingIndex === index) {
      setMetadataEditingIndex(null);
      setMetadataInputKey('');
      setMetadataInputValue('');
    }
  };

  const handleSaveMetadataModal = () => {
    setForm((prev) => ({ ...prev, metadataPairs: metadataDraftRows }));
    closeMetadataModal();
  };

  const handleSaveEvent = async (event) => {
    event.preventDefault();
    setError('');

    if (!selectedDate) {
      setError('Selecione um dia para cadastrar o evento.');
      return;
    }

    if (!form.title.trim()) {
      setError('Informe o título do evento.');
      return;
    }

    if (!form.startTime) {
      setError('Informe a hora de início do evento.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        eventDate: selectedDate,
        title: form.title,
        information: form.information,
        startTime: form.startTime,
        partyFlyerUrl: form.partyFlyerUrl,
        analyticsMetadata: buildMetadataPayload(form.metadataPairs),
      };

      if (editingEventId) {
        await adminApi.updateEstablishmentAgendaEvent(editingEventId, payload);
      } else {
        await adminApi.createEstablishmentAgendaEvent(payload);
      }

      closeModal();
      setFeedback(editingEventId ? 'Evento atualizado com sucesso.' : 'Evento salvo com sucesso.');
      await loadAgenda();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteEvent = (agendaEvent, domEvent) => {
    if (domEvent) {
      domEvent.preventDefault();
      domEvent.stopPropagation();
    }

    setPendingDeleteEvent(agendaEvent);
  };

  const closeDeleteModal = () => {
    setPendingDeleteEvent(null);
  };

  const handleConfirmDeleteEvent = async () => {
    if (!pendingDeleteEvent) {
      return;
    }

    setError('');

    try {
      await adminApi.deleteEstablishmentAgendaEvent(pendingDeleteEvent.id);
      setFeedback('Evento excluído com sucesso.');

      if (editingEventId === pendingDeleteEvent.id) {
        closeModal();
      }

      closeDeleteModal();

      await loadAgenda();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (!hasApprovedLink) {
    return (
      <div className="admin-page-stack">
        <section className="panel">
          <h2>Agenda</h2>
          <p>A agenda fica disponível após a aprovação da vinculação do estabelecimento.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page-stack">
      {feedback ? (
        <div className="admin-toast" role="status" aria-live="polite">
          {feedback}
        </div>
      ) : null}

      <section className="panel">
        <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Agenda do estabelecimento</h2>
          <strong style={{ textTransform: 'capitalize' }}>{monthLabel}</strong>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {loadingEvents ? (
          <div className="admin-grid-loader" role="status" aria-live="polite" aria-label="Carregando agenda">
            <span className="spinner" aria-hidden="true" />
          </div>
        ) : null}

        {!loadingEvents ? (
          <div className="agenda-calendar">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((dayLabel) => (
              <div key={dayLabel} className="agenda-calendar__weekday">
                {dayLabel}
              </div>
            ))}

            {calendarCells.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="agenda-calendar__cell agenda-calendar__cell--empty" />;
              }

              const dateKey = `${year}-${pad(month)}-${pad(day)}`;
              const dayEvents = eventsByDay.get(dateKey) || [];

              return (
                <div key={dateKey} className="agenda-calendar__cell">
                  <div className="agenda-calendar__cell-header">
                    <span className="agenda-calendar__day">{day}</span>
                    <button
                      type="button"
                      className="agenda-calendar__add-inline"
                      onClick={() => openModalForDay(day)}
                      aria-label={`Novo evento no dia ${day}`}
                      title="Novo evento"
                    >
                      +
                    </button>
                  </div>

                  <div className="agenda-calendar__events">
                    {dayEvents.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        className="agenda-calendar__event-badge"
                        title={item.title}
                        onClick={() => openModalForEvent(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openModalForEvent(item);
                          }
                        }}
                      >
                        <span className="agenda-calendar__event-title">{formatEventTime(item.startTime)}</span>
                        <button
                          type="button"
                          className="agenda-calendar__event-delete"
                          onClick={(event) => requestDeleteEvent(item, event)}
                          title="Excluir evento"
                          aria-label={`Excluir evento ${item.title}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {dayEvents.length > 3 ? (
                      <span className="agenda-calendar__event-title">+{dayEvents.length - 3} eventos</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {modalOpen ? (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Cadastrar evento na agenda">
          <div className="panel admin-overlay__content admin-image-modal">
            <div className="admin-overlay__header">
              <h2>{editingEventId ? 'Editar evento' : 'Novo evento'} ({formatBrazilDate(selectedDate)})</h2>
            </div>

            <form className="admin-form" onSubmit={handleSaveEvent}>
              <div className="agenda-event-form__top">
                <div className="agenda-event-form__flyer">
                  <p className="auth-subtitle">Folder da festa</p>
                  <div className="admin-image-preview">
                    <input
                      ref={flyerFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFlyerFileChange}
                      style={{ display: 'none' }}
                    />

                    <button
                      type="button"
                      className="admin-logo-picker"
                      onClick={() => {
                        if (form.partyFlyerUrl && !flyerLoadError) {
                          setFlyerPreviewOpen(true);
                          return;
                        }
                        handleOpenFlyerPicker();
                      }}
                    >
                      {form.partyFlyerUrl && !flyerLoadError ? (
                        <img
                          src={form.partyFlyerUrl}
                          alt="Preview do folder da festa"
                          onError={() => setFlyerLoadError(true)}
                        />
                      ) : (
                        <span>{form.partyFlyerUrl ? 'Imagem indisponível' : 'Selecionar folder'}</span>
                      )}

                      {form.partyFlyerUrl ? (
                        <span
                          role="button"
                          tabIndex={0}
                          className="admin-logo-picker__trash"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRemoveFlyer();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              handleRemoveFlyer();
                            }
                          }}
                          aria-label="Excluir folder"
                          title="Excluir"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
                          </svg>
                        </span>
                      ) : null}

                      <span
                        role="button"
                        tabIndex={0}
                        className="admin-logo-picker__zoom"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleOpenFlyerPicker();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            handleOpenFlyerPicker();
                          }
                        }}
                        aria-label="Pesquisar imagem do folder"
                        title="Pesquisar"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M10 4a6 6 0 104.24 10.24l4.76 4.76 1.41-1.41-4.76-4.76A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z" />
                        </svg>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="agenda-event-form__meta">
                  <label>
                    Título
                    <input
                      value={form.title}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    Hora início
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                      required
                    />
                  </label>
                </div>
              </div>

              <label className="agenda-event-form__information">
                Informações
                <textarea
                  rows={4}
                  value={form.information}
                  onChange={(event) => setForm((prev) => ({ ...prev, information: event.target.value }))}
                />
              </label>

              <div className="agenda-event-form__metadata">
                <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className="auth-subtitle" style={{ marginBottom: '0' }}>
                    Dados para estatísticas
                  </p>
                  <div className="inline-row" style={{ gap: '8px' }}>
                    <span className="pill">{metadataCount}</span>
                    <button type="button" className="btn btn--ghost" onClick={openMetadataModal}>
                      Visualizar
                    </button>
                  </div>
                </div>
              </div>

              <div className="inline-row" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn--ghost" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Salvando...' : editingEventId ? 'Salvar alterações' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {metadataModalOpen ? (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Editar dados estatísticos">
          <div className="panel admin-overlay__content" style={{ maxWidth: '760px' }}>
            <div className="admin-overlay__header">
              <div className="inline-row" style={{ alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn--ghost agenda-metadata__back"
                  onClick={closeMetadataModal}
                  aria-label="Voltar"
                  title="Voltar"
                >
                  ←
                </button>
                <h2>Dados estatísticos</h2>
              </div>
            </div>

            <div className="agenda-metadata__inputs">
              <input
                value={metadataInputKey}
                onChange={(event) => setMetadataInputKey(event.target.value)}
                placeholder="Campo (ex: tipo_festa, promoção, tema)"
              />
              <input
                value={metadataInputValue}
                onChange={(event) => setMetadataInputValue(event.target.value)}
                placeholder="Valor (ex: eletrônica, rodada dupla, sertanejo)"
              />
              <button type="button" className="btn btn--primary" onClick={handleApplyMetadataInput}>
                {metadataEditingIndex !== null ? 'Salvar' : 'Adicionar'}
              </button>
            </div>

            <div className="agenda-metadata__grid">
              {!metadataDraftRows.length ? <p>Nenhum dado estatístico cadastrado.</p> : null}

              {metadataDraftRows.map((entry, index) => (
                <button
                  key={`metadata-grid-${index}`}
                  type="button"
                  className={`agenda-metadata__row ${metadataEditingIndex === index ? 'is-active' : ''}`}
                  onClick={() => handleSelectMetadataRow(index)}
                >
                  <span>{entry.key}</span>
                  <span>{entry.value}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="agenda-metadata__remove"
                    onClick={(event) => handleRemoveMetadataDraft(index, event)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleRemoveMetadataDraft(index, event);
                      }
                    }}
                    title="Remover"
                    aria-label={`Remover dado ${entry.key}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>

            <div className="inline-row" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" className="btn btn--ghost" onClick={closeMetadataModal}>
                Cancelar
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSaveMetadataModal}>
                Salvar dados
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {flyerPreviewOpen && form.partyFlyerUrl ? (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Preview do folder da festa">
          <div className="panel admin-overlay__content admin-image-modal">
            <div className="admin-overlay__header">
              <h2>Preview do folder</h2>
              <button
                type="button"
                className="btn btn--ghost admin-image-modal__close"
                onClick={() => setFlyerPreviewOpen(false)}
                aria-label="Fechar preview"
                title="Fechar"
              >
                X
              </button>
            </div>
            <div className="admin-image-modal__body">
              <img src={form.partyFlyerUrl} alt="Folder da festa" />
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteEvent ? (
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Confirmar exclusão do evento">
          <div className="panel admin-overlay__content" style={{ maxWidth: '460px' }}>
            <div className="admin-overlay__header">
              <h2>Excluir evento</h2>
            </div>
            <p>
              Deseja realmente excluir o evento <strong>{pendingDeleteEvent.title}</strong>?
            </p>
            <p className="auth-subtitle" style={{ marginTop: '-8px' }}>
              Esta ação não poderá ser desfeita.
            </p>

            <div className="inline-row" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" className="btn btn--ghost" onClick={closeDeleteModal}>
                Cancelar
              </button>
              <button type="button" className="btn btn--primary" onClick={handleConfirmDeleteEvent}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
