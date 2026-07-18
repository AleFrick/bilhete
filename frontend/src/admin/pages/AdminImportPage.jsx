import { useEffect, useMemo, useRef, useState } from 'react';

import { adminApi } from '../api/adminClient';
import AppNotice from '../../components/AppNotice';

const PAGE_SIZE = 50;

export default function AdminImportPage() {
  const [city, setCity] = useState('');
  const [bbox, setBbox] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [results, setResults] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [showImportMenu, setShowImportMenu] = useState(false);

  const fileInputRef = useRef(null);
  const importMenuRef = useRef(null);

  useEffect(() => {
    if (!showImportMenu) return;
    const handler = (e) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showImportMenu]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setResults(null);
    setFeedback('');
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setFeedback('Selecione um arquivo .pbf ou .osm.pbf.');
      return;
    }

    if (!city.trim()) {
      setFeedback('Informe o nome da cidade para filtrar.');
      return;
    }

    setLoading(true);
    setFeedback('');
    setResults(null);

    try {
      const data = await adminApi.importPbf(selectedFile, city.trim(), bbox.trim());
      setResults(data);
      setFeedback(`Foram encontrados ${data.totalFound} locais em ${data.city}.`);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setCity('');
    setBbox('');
    setResults(null);
    setFeedback('');
    setCategoryFilter('');
    setNameFilter('');
    setSelectedIds(new Set());
    setCurrentPage(0);
  };

  const categories = useMemo(() => {
    if (!results) return [];
    const set = new Set(results.places.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [results]);

  const filteredPlaces = useMemo(() => {
    if (!results) return [];
    return results.places.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (nameFilter && !p.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      return true;
    });
  }, [results, categoryFilter, nameFilter]);

  const totalPages = Math.ceil(filteredPlaces.length / PAGE_SIZE);
  const pagePlaces = filteredPlaces.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const toggleSelect = (osmId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(osmId)) {
        next.delete(osmId);
      } else {
        next.add(osmId);
      }
      return next;
    });
  };

  const toggleSelectPage = () => {
    const pageIds = pagePlaces.map((p) => p.osmId);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleImportSelected = async () => {
    const selected = filteredPlaces.filter((p) => selectedIds.has(p.osmId));
    if (selected.length === 0) {
      setFeedback('Selecione ao menos um local para importar.');
      return;
    }
    setImporting(true);
    setFeedback('');
    setShowImportMenu(false);
    try {
      const payload = selected.map((p) => ({
        name: p.name,
        city: p.city || city.split(',')[0].trim(),
        address: p.address || '',
        lat: p.lat,
        lng: p.lng,
        category: p.category || '',
      }));
      const result = await adminApi.batchCreateVenues(payload);
      setFeedback(`Importação concluída: ${result.inserted} inseridos, ${result.updated || 0} atualizados, ${result.skipped || 0} ignorados de ${result.total} locais.`);
      setSelectedIds(new Set());
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImportAll = async () => {
    if (filteredPlaces.length === 0) {
      setFeedback('Não há locais para importar.');
      return;
    }
    setImporting(true);
    setFeedback('');
    setShowImportMenu(false);
    try {
      const payload = filteredPlaces.map((p) => ({
        name: p.name,
        city: p.city || city.split(',')[0].trim(),
        address: p.address || '',
        lat: p.lat,
        lng: p.lng,
        category: p.category || '',
      }));
      const result = await adminApi.batchCreateVenues(payload);
      setFeedback(`Importação concluída: ${result.inserted} inseridos, ${result.updated || 0} atualizados, ${result.skipped || 0} ignorados de ${result.total} locais.`);
      setSelectedIds(new Set());
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="admin-page-stack">
      <AppNotice
        message={feedback}
        type={feedback.includes('encontrados') || feedback.includes('concluída') ? 'success' : 'error'}
        floating
        autoHideMs={5000}
        onClose={() => setFeedback('')}
      />

      <section className="panel">
        <h2>Importar Locais</h2>

        <div className="admin-form" style={{ flexDirection: 'row', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: '0 1 220px' }}>
            Cidade *
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Ex: Porto Alegre"
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary, #888)' }}>Arquivo .pbf *</span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? selectedFile.name : 'Selecionar .pbf'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pbf,.osm.pbf,application/octet-stream"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleImport}
              disabled={loading}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              {loading ? 'Processando...' : 'Carregar'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleReset}
              disabled={loading}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              Limpar
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="panel">
          <p>Processando arquivo PBF... Isso pode levar alguns minutos dependendo do tamanho do arquivo.</p>
        </section>
      ) : null}

      {!loading && results ? (
        <section className="panel">
          <h3>Resultados ({filteredPlaces.length} de {results.totalFound} locais em {results.city})</h3>

          {results.places.length > 0 ? (
            <>
              <div className="admin-form" style={{ flexDirection: 'row', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}>
                <label style={{ flex: 1 }}>
                  Filtrar por nome
                  <input
                    value={nameFilter}
                    onChange={(event) => { setNameFilter(event.target.value); setCurrentPage(0); }}
                    placeholder="Buscar por nome..."
                  />
                </label>
                <label style={{ flex: 1 }}>
                  Categoria
                  <select
                    value={categoryFilter}
                    onChange={(event) => { setCategoryFilter(event.target.value); setCurrentPage(0); }}
                  >
                    <option value="">Todas ({results.places.length})</option>
                    {categories.map((cat) => {
                      const count = results.places.filter((p) => p.category === cat).length;
                      return (
                        <option key={cat} value={cat}>{cat} ({count})</option>
                      );
                    })}
                  </select>
                </label>
                {(categoryFilter || nameFilter) ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => { setCategoryFilter(''); setNameFilter(''); setCurrentPage(0); }}
                  >
                    Limpar filtros
                  </button>
                ) : null}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary, #888)' }}>
                  {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : 'Nenhum selecionado'}
                </span>
                <div style={{ position: 'relative', display: 'flex' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleImportSelected}
                    disabled={importing || selectedIds.size === 0}
                    style={{ borderRadius: '4px 0 0 4px' }}
                  >
                    {importing ? 'Importando...' : `Importar selecionados${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setShowImportMenu((v) => !v)}
                    disabled={importing}
                    style={{ width: '28px', minWidth: '28px', padding: 0, borderRadius: '0 4px 4px 0', borderLeft: '1px solid rgba(255,255,255,0.3)' }}
                    title="Mais opções"
                  >
                    ▾
                  </button>
                  {showImportMenu ? (
                    <div
                      ref={importMenuRef}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '4px',
                        background: 'var(--bg-panel, #fff)',
                        border: '1px solid var(--border, #ddd)',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 100,
                        minWidth: '220px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleImportAll}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '10px 16px',
                          border: 'none',
                          background: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        Importar todos ({filteredPlaces.length})
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '32px' }}>
                      <input
                        type="checkbox"
                        checked={pagePlaces.length > 0 && pagePlaces.every((p) => selectedIds.has(p.osmId))}
                        onChange={toggleSelectPage}
                      />
                    </th>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Cidade</th>
                    <th>Endereço</th>
                    <th>Lat</th>
                    <th>Lng</th>
                  </tr>
                </thead>
                <tbody>
                  {pagePlaces.map((place) => (
                    <tr key={place.osmId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(place.osmId)}
                          onChange={() => toggleSelect(place.osmId)}
                        />
                      </td>
                      <td>{place.name}</td>
                      <td>{place.category || '-'}</td>
                      <td>{place.city || '-'}</td>
                      <td>{place.address || '-'}</td>
                      <td>{place.lat}</td>
                      <td>{place.lng}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setCurrentPage(0)}
                    disabled={currentPage === 0}
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    ‹
                  </button>
                  <span style={{ fontSize: '14px' }}>
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setCurrentPage(totalPages - 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    »
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p>Nenhum local encontrado para a cidade informada.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
