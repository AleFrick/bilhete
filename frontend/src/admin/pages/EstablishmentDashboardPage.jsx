import { useMemo, useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function buildMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

function buildLast30Days() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { startDate: toIsoDate(start), endDate: toIsoDate(now) };
}

function formatDuration(minutes) {
  if (!minutes || minutes < 1) return '-';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  return `${m}min`;
}

function formatDateBR(isoDate) {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function BarChart({ data, labelKey, valueKey, color = '#e0264c', maxBars = 20 }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const bars = data.slice(0, maxBars);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px', paddingTop: '8px' }}>
      {bars.map((item, i) => {
        const pct = (item[valueKey] / max) * 100;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              height: '100%',
              minWidth: 0,
            }}
            title={`${item[labelKey]}: ${item[valueKey]}`}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '24px',
                height: `${Math.max(pct, 2)}%`,
                background: color,
                borderRadius: '3px 3px 0 0',
                opacity: 0.85,
                transition: 'opacity 0.15s',
              }}
            />
            {bars.length <= 12 ? (
              <span style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {item[labelKey]}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sublabel }) {
  return (
    <div
      className="panel"
      style={{
        padding: '16px',
        textAlign: 'center',
        flex: '1 1 140px',
        minWidth: '140px',
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: '0.78rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#e0264c' }}>
        {value}
      </p>
      {sublabel ? (
        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', opacity: 0.5 }}>{sublabel}</p>
      ) : null}
    </div>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <div className="panel" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const PRESETS = [
  { label: 'Últimos 30 dias', fn: buildLast30Days },
  { label: 'Este mês', fn: buildMonthRange },
];

export default function EstablishmentDashboardPage({ hasApprovedLink }) {
  const initialRange = useMemo(() => buildLast30Days(), []);

  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.establishmentDashboard({ startDate, endDate });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasApprovedLink) {
    return (
      <div className="admin-page-stack">
        <section className="panel">
          <h2>Dashboard Pro</h2>
          <p>O dashboard fica disponível após a aprovação da vinculação do estabelecimento.</p>
        </section>
      </div>
    );
  }

  const t = data?.totals;

  return (
    <div className="admin-page-stack">
      {/* Header + filtros */}
      <section className="panel">
        <div className="inline-row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Dashboard Pro</h2>
          <div className="inline-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={() => {
                  const range = preset.fn();
                  setStartDate(range.startDate);
                  setEndDate(range.endDate);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-form__compact admin-form__compact--three" style={{ marginTop: '12px' }}>
          <label>
            Data inicial
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            Data final
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn btn--primary"
              style={{ width: '100%' }}
              onClick={loadDashboard}
              disabled={loading}
            >
              {loading ? 'Carregando...' : 'Gerar dashboard'}
            </button>
          </label>
        </div>

        <AppNotice message={error} type="error" onClose={() => setError('')} />
      </section>

      {!data && !loading ? (
        <section className="panel">
          <p>Selecione o período e clique em "Gerar dashboard" para visualizar as métricas.</p>
        </section>
      ) : null}

      {loading ? (
        <section className="panel">
          <p>Carregando métricas...</p>
        </section>
      ) : null}

      {data && !loading ? (
        <>
          {/* Cards de totais */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <StatCard label="Check-ins" value={t?.totalCheckins ?? 0} sublabel={`${t?.activeDays ?? 0} dias ativos`} />
            <StatCard label="Visitantes únicos" value={t?.uniqueVisitors ?? 0} />
            <StatCard
              label="Permanência média"
              value={formatDuration(t?.avgDwellMinutes)}
              sublabel={`${t?.completedCheckouts ?? 0} check-outs`}
            />
            <StatCard
              label="Novos vs Recorrentes"
              value={`${t?.newVisitors ?? 0} / ${t?.returningVisitors ?? 0}`}
              sublabel="novos / recorrentes"
            />
          </div>

          {/* Gráficos de movimento */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            <SectionCard title="Check-ins por dia">
              {data.checkinsByDay?.length ? (
                <>
                  <BarChart data={data.checkinsByDay} labelKey="day" valueKey="checkins" maxBars={30} />
                  <p style={{ fontSize: '0.72rem', opacity: 0.4, textAlign: 'center', margin: '4px 0 0' }}>
                    {formatDateBR(data.checkinsByDay[0]?.day)} a {formatDateBR(data.checkinsByDay[data.checkinsByDay.length - 1]?.day)}
                  </p>
                </>
              ) : (
                <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Sem dados no período.</p>
              )}
            </SectionCard>

            <SectionCard title="Check-ins por dia da semana">
              {data.checkinsByWeekday?.length ? (
                <BarChart data={data.checkinsByWeekday} labelKey="weekday" valueKey="checkins" maxBars={7} />
              ) : (
                <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Sem dados no período.</p>
              )}
            </SectionCard>

            <SectionCard title="Horários de pico">
              {data.checkinsByHour?.length ? (
                <BarChart
                  data={data.checkinsByHour.map((r) => ({ ...r, hourLabel: `${r.hour}h` }))}
                  labelKey="hourLabel"
                  valueKey="checkins"
                  maxBars={24}
                  color="#ff6b8a"
                />
              ) : (
                <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Sem dados no período.</p>
              )}
            </SectionCard>
          </div>

          {/* Público */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            <SectionCard title="Faixa etária">
              {data.ageRange?.length ? (
                <ul className="simple-list" style={{ fontSize: '0.85rem' }}>
                  {data.ageRange.map((item, i) => {
                    const maxV = Math.max(...data.ageRange.map((r) => r.visitors), 1);
                    return (
                      <li key={i} style={{ padding: '6px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>{item.range}</span>
                          <strong>{item.visitors}</strong>
                        </div>
                        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                          <div
                            style={{
                              width: `${(item.visitors / maxV) * 100}%`,
                              height: '100%',
                              borderRadius: '2px',
                              background: '#e0264c',
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Sem dados no período.</p>
              )}
            </SectionCard>
          </div>

          {/* Rankings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            <SectionCard title="Dias de maior movimento (Top 10)">
              {data.topDays?.length ? (
                <ul className="simple-list" style={{ fontSize: '0.85rem' }}>
                  {data.topDays.map((item, i) => (
                    <li key={i} style={{ padding: '6px 0' }}>
                      <div>
                        <strong>{formatDateBR(item.day)}</strong>
                        <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.6 }}>
                          {item.checkins} check-ins | {item.uniqueVisitors} únicos
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(224,38,76,0.12)',
                          color: '#e0264c',
                        }}
                      >
                        #{i + 1}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Sem dados no período.</p>
              )}
            </SectionCard>

            <SectionCard title="Top clientes (mais check-ins)">
              {data.topClients?.length ? (
                <ul className="simple-list" style={{ fontSize: '0.85rem' }}>
                  {data.topClients.map((item, i) => (
                    <li key={i} style={{ padding: '6px 0' }}>
                      <div>
                        <strong>{item.name}</strong>
                        <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.6 }}>
                          {item.checkinCount} check-ins
                          {item.lastVisit ? ` | Última visita: ${formatDateBR(String(item.lastVisit).slice(0, 10))}` : ''}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(224,38,76,0.12)',
                          color: '#e0264c',
                        }}
                      >
                        #{i + 1}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Sem dados no período.</p>
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
