import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, X, MapPin, RefreshCw, Eye, Check, CheckCircle2, AlertCircle } from 'lucide-react';
import { getLotes, updateLote } from '../lib/api/lotes';
import { formatCOP, getEstadoBadge } from '../utils/helpers';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const ESTADOS = ['Todos', 'VENDIDO', 'PAGADO EN SU TOTALIDAD', 'DISPONIBLE', 'EN NEGOCIACIÓN', 'APARTADO', 'NO APTO PARA VENTA'];

export default function Lotes() {
  const [allLotes, setAllLotes]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filtroEstado, setFiltro]   = useState('Todos');
  const [selected, setSelected]     = useState(null);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [statusMsg, setStatusMsg]   = useState(null);


  // Paginación
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(50);

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLotes();
      setAllLotes(data || []);
    } catch (err) {
      console.error('Error cargando lotes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLotes();
  }, [fetchLotes]);

  const handleCambiarEstado = async (loteId, nuevoEstado) => {
    if (!loteId || !nuevoEstado) return;
    setStatusLoadingId(loteId);
    try {
      await updateLote(loteId, { estado: nuevoEstado });
      setAllLotes(prev => prev.map(l => l.id === loteId ? { ...l, estado: nuevoEstado } : l));
      setSelected(prev => prev && prev.id === loteId ? { ...prev, estado: nuevoEstado } : prev);
      setStatusMsg({ type: 'success', text: `Estado actualizado a "${nuevoEstado}" con éxito.` });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      setStatusMsg({ type: 'error', text: 'Error al cambiar estado: ' + (err.message || err) });
      setTimeout(() => setStatusMsg(null), 5000);
    } finally {
      setStatusLoadingId(null);
    }
  };


  // Contadores globales exactos e independientes del filtro
  const counters = useMemo(() => {
    return ESTADOS.slice(1).map(e => ({
      estado: e,
      count: allLotes.filter(l => l.estado === e).length,
    }));
  }, [allLotes]);

  // Filtrado 100% en memoria
  const filteredLotes = useMemo(() => {
    let list = allLotes;
    if (filtroEstado && filtroEstado !== 'Todos') {
      list = list.filter(l => l.estado === filtroEstado);
    }
    if (search.trim()) {
      const s = search.toLowerCase().trim();
      list = list.filter(l =>
        (l.id_lote && l.id_lote.toLowerCase().includes(s)) ||
        (l.propietario && l.propietario.toLowerCase().includes(s)) ||
        (l.etapa && String(l.etapa).toLowerCase().includes(s)) ||
        (l.manzana && String(l.manzana).toLowerCase().includes(s))
      );
    }
    return list;
  }, [allLotes, filtroEstado, search]);

  const paginatedLotes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLotes.slice(start, start + pageSize);
  }, [filteredLotes, page, pageSize]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleFiltroClick = (estado) => {
    setFiltro(filtroEstado === estado ? 'Todos' : estado);
    setPage(1);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Gestión de Lotes</div>
          <div className="page-subtitle">
            Proyecto La Ceiba · {allLotes.length} lotes registrados
          </div>
        </div>
        <button className="btn btn-primary">
          <Plus size={14} /> Nuevo Lote
        </button>
      </div>

      {/* Stats chips */}
      <div className="stats-row">
        {counters.map(c => {
          const badge = getEstadoBadge(c.estado);
          return (
            <div
              key={c.estado}
              className="stat-chip"
              style={{ borderColor: filtroEstado === c.estado ? badge.color : undefined, cursor: 'pointer' }}
              onClick={() => handleFiltroClick(c.estado)}
            >
              <span className="stat-dot" style={{ background: badge.color }} />
              <span className="stat-chip-val">{c.count}</span>
              <span className="stat-chip-label">{badge.label}</span>
            </div>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="search-bar">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
          <input
            className="search-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar por ID de lote, propietario, manzana..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <select
          className="filter-select"
          value={filtroEstado}
          onChange={e => { setFiltro(e.target.value); setPage(1); }}
        >
          {ESTADOS.map(e => <option key={e}>{e}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={fetchLotes} title="Refrescar lotes">
          <RefreshCw size={14} />
        </button>
      </div>

      {statusMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
          background: statusMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: statusMsg.type === 'success' ? '#15803d' : '#b91c1c',
          border: `1px solid ${statusMsg.type === 'success' ? '#86efac' : '#fca5a5'}`
        }}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Table */}
      <div className="table-container">

        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="table-header-title">
            Lotes ({filteredLotes.length})
            {filtroEstado !== 'Todos' && ` · ${filtroEstado}`}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Mostrando {paginatedLotes.length} de {filteredLotes.length}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }} />
            Cargando lotes...
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID Lote</th>
                    <th>Etapa</th>
                    <th>Manzana</th>
                    <th>Lote</th>
                    <th>Área</th>
                    <th>Precio de Lista</th>
                    <th>Precio Venta</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLotes.map((l, idx) => {
                    const badge = getEstadoBadge(l.estado);
                    const rowNum = (page - 1) * pageSize + idx + 1;
                    return (
                      <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(l)}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{rowNum}</td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                          {l.id_lote}
                        </td>
                        <td>{l.etapa ? `Etapa ${l.etapa}` : '—'}</td>
                        <td>{l.manzana ? `Mz ${l.manzana}` : '—'}</td>
                        <td>{l.lote ?? '—'}</td>
                        <td>{l.area_m2 ? `${l.area_m2} m²` : '—'}</td>
                        <td>{formatCOP(l.precio_lote)}</td>
                        <td>{l.precio_venta ? formatCOP(l.precio_venta) : '—'}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <select
                              value={l.estado || 'DISPONIBLE'}
                              onChange={e => handleCambiarEstado(l.id, e.target.value)}
                              disabled={statusLoadingId === l.id}
                              style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.color}60`,
                                borderRadius: 14,
                                padding: '3px 22px 3px 10px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: statusLoadingId === l.id ? 'not-allowed' : 'pointer',
                                outline: 'none',
                                transition: 'all 0.15s ease'
                              }}
                              title="Clic para cambiar el estado de este lote"
                            >
                              {ESTADOS.slice(1).map(st => (
                                <option key={st} value={st} style={{ background: '#ffffff', color: '#1e293b' }}>
                                  {getEstadoBadge(st).label}
                                </option>
                              ))}
                            </select>
                            <span style={{
                              position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                              pointerEvents: 'none', fontSize: 9, color: badge.color, fontWeight: 900
                            }}>▾</span>
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>

                          <button
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', fontSize: 12, gap: 4 }}
                            onClick={() => setSelected(l)}
                          >
                            <Eye size={12} /> Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLotes.length === 0 && (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                        No se encontraron lotes con los criterios actuales
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalItems={filteredLotes.length}
              pageSize={pageSize}
              pageSizeOptions={[25, 50, 100]}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {selected.id_lote}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Proyecto La Ceiba · Etapa {selected.etapa ?? '—'}
              </div>
            </div>
            <span
              className="badge"
              style={{
                background: getEstadoBadge(selected.estado).bg,
                color: getEstadoBadge(selected.estado).color,
                fontSize: 13, padding: '4px 12px',
              }}
            >
              {getEstadoBadge(selected.estado).label}
            </span>
          </div>

          <div className="detail-grid">
            {[
              ['Manzana',              selected.manzana ? `Manzana ${selected.manzana}` : '—'],
              ['Lote',                 selected.lote ? `Lote ${selected.lote}` : '—'],
              ['Área',                 selected.area_m2 ? `${selected.area_m2} m²` : '—'],
              ['Precio de Lista',      formatCOP(selected.precio_lote)],
              ['Precio Venta',         selected.precio_venta ? formatCOP(selected.precio_venta) : '—'],
              ['Propietario / Titular',selected.propietario ?? '—'],
              ['Contrato',             selected.contrato ?? '—'],
              ['Escritura',            selected.escritura ?? '—'],
              ['Fecha Escritura',      selected.fecha_escritura ?? '—'],
              ['% Escriturado',        selected.porcentaje_escriturado ? `${selected.porcentaje_escriturado}%` : '—'],
            ].map(([l, v]) => (
              <div className="detail-item" key={l}>
                <div className="detail-label">{l}</div>
                <div className="detail-value">{v}</div>
              </div>
            ))}
          </div>

          {/* Panel interactivo para cambiar estado del lote */}
          <div style={{
            marginTop: 18,
            padding: '14px 16px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                🏷️ Cambiar Estado del Lote:
              </span>
              {statusLoadingId === selected.id && (
                <span style={{ fontSize: 12, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Guardando cambios...
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ESTADOS.slice(1).map(st => {
                const b = getEstadoBadge(st);
                const isCurrent = selected.estado === st;
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={statusLoadingId === selected.id}
                    onClick={() => handleCambiarEstado(selected.id, st)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: isCurrent ? `2px solid ${b.color}` : '1px solid #cbd5e1',
                      background: isCurrent ? b.bg : '#ffffff',
                      color: isCurrent ? b.color : '#475569',
                      fontWeight: isCurrent ? 800 : 500,
                      fontSize: 12,
                      cursor: statusLoadingId === selected.id ? 'not-allowed' : 'pointer',
                      boxShadow: isCurrent ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color }} />
                    {b.label}
                    {isCurrent && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          </div>

          {selected.observacion && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-base)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                Observaciones:
              </div>
              <div style={{ fontSize: 13 }}>{selected.observacion}</div>
            </div>
          )}

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
        </Modal>
      )}

    </div>
  );
}
