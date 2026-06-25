import { useMemo, useState } from 'react';

import { adminApi } from '../api/adminClient';

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function buildMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

export default function EstablishmentAgendaStatsPage({ hasApprovedLink }) {
  const initialRange = useMemo(() => buildMonthRange(), []);

  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await adminApi.establishmentAgendaStats({ startDate, endDate });
      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasApprovedLink) {
    return (
      <div className="admin-page-stack">
        <section className="panel">
          <h2>Estatísticas</h2>
          <p>As estatísticas ficam disponíveis após a aprovação da vinculação do estabelecimento.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page-stack">
      <section className="panel">
        <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Estatísticas da agenda</h2>
          <button type="button" className="btn btn--primary" onClick={loadStats} disabled={loading}>
            {loading ? 'Carregando...' : 'Gerar'}
          </button>
        </div>

        <div className="admin-form__compact admin-form__compact--three">
          <label>
            Data inicial
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>

          <label>
            Data final
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {result ? (
          <div className="agenda-stats">
            <div className="agenda-stats__totals">
              <div className="panel agenda-stats__card">
                <p>Total de eventos</p>
                <strong>{result?.totals?.events || 0}</strong>
              </div>
              <div className="panel agenda-stats__card">
                <p>Total de check-ins no período</p>
                <strong>{result?.totals?.checkins || 0}</strong>
              </div>
            </div>

            <div className="panel">
              <h3>Insights por campo</h3>
              {!Array.isArray(result.metrics) || !result.metrics.length ? (
                <p>Nenhum dado de estatística cadastrado nos eventos para este período.</p>
              ) : (
                <ul className="simple-list">
                  {result.metrics.map((item, index) => (
                    <li key={`${item.key}-${item.value}-${index}`}>
                      <div>
                        <strong>{item.key}</strong>
                        <p>{item.value}</p>
                      </div>
                      <div className="inline-row">
                        <span className="pill">Eventos: {item.eventCount}</span>
                        <span className="pill">Check-ins: {item.checkins}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p>Selecione o período e clique em Gerar para visualizar o BI inicial.</p>
        )}
      </section>
    </div>
  );
}
