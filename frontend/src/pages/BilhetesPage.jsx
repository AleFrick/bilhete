import { useMemo, useState } from 'react';

function normalizeTimestamp(value) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default function BilhetesPage({ inbox, outbox, onRespond }) {
  const [filter, setFilter] = useState('todos');

  const bilhetes = useMemo(() => {
    const received = inbox.map((item) => ({
      ...item,
      direction: 'recebido',
      personName: item.fromName,
    }));

    const sent = outbox.map((item) => ({
      ...item,
      direction: 'enviado',
      personName: item.toName,
    }));

    const merged = [...received, ...sent].sort(
      (a, b) => normalizeTimestamp(b.createdAt) - normalizeTimestamp(a.createdAt)
    );

    if (filter === 'recebidos') {
      return merged.filter((item) => item.direction === 'recebido');
    }

    if (filter === 'enviados') {
      return merged.filter((item) => item.direction === 'enviado');
    }

    return merged;
  }, [filter, inbox, outbox]);

  return (
    <div className="page-stack">
      <section className="panel">
        <h3>Bilhetes</h3>

        <div className="inline-row">
          <button
            type="button"
            className={`badge-option ${filter === 'todos' ? 'is-active' : ''}`}
            onClick={() => setFilter('todos')}
          >
            Todos
          </button>
          <button
            type="button"
            className={`badge-option ${filter === 'recebidos' ? 'is-active' : ''}`}
            onClick={() => setFilter('recebidos')}
          >
            Recebidos
          </button>
          <button
            type="button"
            className={`badge-option ${filter === 'enviados' ? 'is-active' : ''}`}
            onClick={() => setFilter('enviados')}
          >
            Enviados
          </button>
        </div>

        {!bilhetes.length ? <p>Nenhum bilhete encontrado para este filtro.</p> : null}
        <ul className="simple-list">
          {bilhetes.map((item) => (
            <li key={item.id} className={`bilhete-item bilhete-item--${item.direction}`}>
              <div className="bilhete-item__content">
                <strong>{item.personName}</strong>
                <p>
                  {item.type} em {item.venueName}
                </p>
                {item.message ? <p>{item.message}</p> : null}
              </div>
              <div className="bilhete-item__meta">
                {item.status !== 'enviado' ? <span className="pill">{item.status}</span> : null}
                {item.direction === 'recebido' && item.status === 'enviado' ? (
                  <div className="bilhete-actions">
                    <button
                      type="button"
                      className="btn btn--ghost bilhete-action-btn bilhete-action-btn--respond"
                      onClick={() => onRespond(item.id, 'respondido')}
                      aria-label="Responder bilhete"
                      title="Responder"
                    >
                      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <path d="M12.1 21.35 10.65 20C5.5 15.36 2 12.19 2 8.31A5.31 5.31 0 0 1 7.31 3a5.76 5.76 0 0 1 4.79 2.65A5.76 5.76 0 0 1 16.89 3 5.31 5.31 0 0 1 22.2 8.31c0 3.88-3.5 7.05-8.65 11.69l-1.45 1.35Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost bilhete-action-btn bilhete-action-btn--ignore"
                      onClick={() => onRespond(item.id, 'ignorado')}
                      aria-label="Ignorar bilhete"
                      title="Ignorar"
                    >
                      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
