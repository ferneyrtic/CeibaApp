import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, X, MapPin, RefreshCw, Eye, Check, CheckCircle2, AlertCircle, Tag, DollarSign, Edit3, BookmarkCheck, FileText, RotateCcw, History } from 'lucide-react';
import { getLotes, updateLote } from '../lib/api/lotes';
import { getCasosEspeciales, obtenerBadgeCasoEspecial } from '../lib/api/casosEspecialesApi';
import { registrarAccion } from '../lib/api/auditApi';
import { countPhysicalLots, obtenerContratoPorLoteOVenta, obtenerHistorialDesistimientos } from '../lib/api/loteLifecycleApi';
import { formatCOP, formatDate, getEstadoBadge } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import ModalNuevoLote from '../components/ModalNuevoLote';
import ModalRegistrarVenta from '../components/ModalRegistrarVenta';
import ModalEditarContrato from '../components/ModalEditarContrato';
import ModalGenerarArras from '../components/ModalGenerarArras';
import ModalGenerarContrato from '../components/ModalGenerarContrato';
import ModalLiberarLote from '../components/ModalLiberarLote';
import ModalVerContrato from '../components/ModalVerContrato';
import EstadoCuentaMatrizView from '../components/EstadoCuentaMatrizView';
import { useAuth } from '../context/AuthContext';

const ESTADOS = ['Todos', 'DISPONIBLE', 'APARTADO', 'VENDIDO', 'PAGADO EN SU TOTALIDAD', 'CEDIDO EN FORMA DE PAGO', 'EN NEGOCIACIÓN', 'NO APTO PARA VENTA'];

export default function Lotes() {
  const { permissions, user } = useAuth();
  const [allLotes, setAllLotes]     = useState([]);
  const [casosEspeciales, setCasosEspeciales] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filtroEstado, setFiltro]   = useState('Todos');
  const [selected, setSelected]     = useState(null);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [statusMsg, setStatusMsg]   = useState(null);

  // Modales operativos
  const [showModalNuevoLote, setShowModalNuevoLote] = useState(false);
  const [showModalVenta, setShowModalVenta]         = useState(false);
  const [loteParaVenta, setLoteParaVenta]           = useState(null);
  const [ventaParaEditar, setVentaParaEditar]       = useState(null);
  const [loadingContrato, setLoadingContrato]       = useState(false);

  // Modales del ciclo estándar de lotes
  const [loteParaArras, setLoteParaArras]           = useState(null);
  const [loteParaContrato, setLoteParaContrato]     = useState(null);
  const [loteParaLiberar, setLoteParaLiberar]       = useState(null);
  const [contratoParaVer, setContratoParaVer]       = useState(null);
  const [historialDesist, setHistorialDesist]       = useState([]);
  const [desistDetalleSnap, setDesistDetalleSnap]   = useState(null);

  // Paginación
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(50);

  const handleEditarContratoLote = async (lote) => {
    if (!lote?.id) return;
    setLoadingContrato(true);
    try {
      const { data: vData, error: vErr } = await supabase
        .from('ventas')
        .select(`
          *,
          lotes (id, id_lote, manzana, lote, area_m2),
          clientes (id, nombre, celular, ciudad, doc_cliente, direccion)
        `)
        .eq('lote_id', lote.id)
        .limit(1);

      if (vErr) throw vErr;
      if (vData && vData.length > 0) {
        setVentaParaEditar(vData[0]);
        setSelected(null);
      } else {
        alert(`No se encontró un contrato registrado para el lote ${lote.id_lote || ''}.`);
      }
    } catch (err) {
      alert('Error buscando contrato del lote: ' + err.message);
    } finally {
      setLoadingContrato(false);
    }
  };

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    try {
      const [data, casos] = await Promise.all([
        getLotes(),
        getCasosEspeciales()
      ]);
      setAllLotes(data || []);
      setCasosEspeciales(casos || []);
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
      const lotePrev = allLotes.find(l => l.id === loteId);
      await updateLote(loteId, { estado: nuevoEstado });
      setAllLotes(prev => prev.map(l => l.id === loteId ? { ...l, estado: nuevoEstado } : l));
      setSelected(prev => prev && prev.id === loteId ? { ...prev, estado: nuevoEstado } : prev);
      setStatusMsg({ type: 'success', text: `Estado actualizado a "${nuevoEstado}" con éxito.` });
      setTimeout(() => setStatusMsg(null), 4000);

      // Registrar acción en auditoría
      try {
        await registrarAccion({
          modulo: 'LOTES',
          accion: 'ESTADO_LOTE_CAMBIADO',
          lote_id: loteId,
          lote_id_str: lotePrev?.id_lote || `Lote ${loteId}`,
          descripcion: `Cambio de estado del lote ${lotePrev?.id_lote || loteId} a "${nuevoEstado}" (anterior: "${lotePrev?.estado || '—'}")`,
          detalles: { loteId, estadoAnterior: lotePrev?.estado, nuevoEstado }
        });
      } catch (logErr) {
        console.warn('Aviso guardando log de lote:', logErr);
      }
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      setStatusMsg({ type: 'error', text: 'Error al cambiar estado: ' + (err.message || err) });
      setTimeout(() => setStatusMsg(null), 5000);
    } finally {
      setStatusLoadingId(null);
    }
  };


  // Contadores globales exactos (registros + lotes físicos)
  const counters = useMemo(() => {
    return ESTADOS.slice(1).map(e => {
      const items = allLotes.filter(l => l.estado === e);
      const physicalCount = items.reduce((acc, l) => acc + countPhysicalLots(l), 0);
      return {
        estado: e,
        count: items.length,
        physicalCount,
      };
    });
  }, [allLotes]);

  const totalPhysicalLots = useMemo(() => (
    allLotes.reduce((acc, l) => acc + countPhysicalLots(l), 0)
  ), [allLotes]);

  useEffect(() => {
    if (selected?.id) {
      obtenerHistorialDesistimientos(selected.id).then(setHistorialDesist);
    } else {
      setHistorialDesist([]);
    }
  }, [selected?.id]);

  const handleVerContratoLote = async (lote) => {
    if (!lote?.id) return;
    setLoadingContrato(true);
    try {
      const { data: vData } = await supabase
        .from('ventas')
        .select('*, lotes(*), clientes(*)')
        .eq('lote_id', lote.id)
        .limit(1);
      const venta = vData?.[0] || null;
      const cto = await obtenerContratoPorLoteOVenta({ lote, venta, cliente: venta?.clientes });
      setContratoParaVer(cto);
    } catch (err) {
      alert('Error cargando contrato: ' + err.message);
    } finally {
      setLoadingContrato(false);
    }
  };

  const handleAbrirLiberarLote = async (lote) => {
    if (!lote?.id) return;
    try {
      const { data: vData } = await supabase
        .from('ventas')
        .select('*, lotes(*), clientes(*)')
        .eq('lote_id', lote.id)
        .limit(1);
      setLoteParaLiberar({ lote, venta: vData?.[0] || null });
    } catch {
      setLoteParaLiberar({ lote, venta: null });
    }
  };

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
            Proyecto La Ceiba · {allLotes.length} registros ({totalPhysicalLots} lotes físicos)
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModalNuevoLote(true)}>
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
              title={c.physicalCount !== c.count ? `${c.count} registros (${c.physicalCount} lotes físicos)` : `${c.count} lotes`}
            >
              <span className="stat-dot" style={{ background: badge.color }} />
              <span className="stat-chip-val">{c.count}</span>
              <span className="stat-chip-label">
                {badge.label}{c.physicalCount !== c.count ? ` (${c.physicalCount} fís.)` : ''}
              </span>
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
                    <th className="col-hide-mobile">Etapa</th>
                    <th className="col-hide-mobile">Manzana</th>
                    <th className="col-hide-mobile">Lote</th>
                    <th>Área</th>
                    <th className="col-hide-mobile">Precio de Lista</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th className="col-hide-mobile">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLotes.map((l, idx) => {
                    const badge = getEstadoBadge(l.estado);
                    const rowNum = (page - 1) * pageSize + idx + 1;
                    const especial = obtenerBadgeCasoEspecial(l.id_lote, casosEspeciales);
                    return (
                      <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => {
                        if (typeof window !== 'undefined' && window.getSelection()?.toString().trim().length > 0) return;
                        setSelected(l);
                      }}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{rowNum}</td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          <div>{l.id_lote}</div>
                          {especial && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 9.5, fontWeight: 700, padding: '1px 6px',
                              borderRadius: 4, background: especial.bg, color: especial.color, marginTop: 2
                            }}>
                              <span>{especial.icon || '📌'}</span> {especial.text}
                            </span>
                          )}
                        </td>
                        <td className="col-hide-mobile">{l.etapa ? `Etapa ${l.etapa}` : '—'}</td>
                        <td className="col-hide-mobile">{l.manzana ? `Mz ${l.manzana}` : '—'}</td>
                        <td className="col-hide-mobile">{l.lote ?? '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{l.area_m2 ? `${l.area_m2} m²` : '—'}</td>
                        <td className="col-hide-mobile">{formatCOP(l.precio_lote)}</td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{l.precio_venta ? formatCOP(l.precio_venta) : formatCOP(l.precio_lote)}</td>
                        <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
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
                                <option key={st} value={st} style={{ background: '#ffffff', color: 'var(--text-primary)' }}>
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
                        <td className="col-hide-mobile" onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {(l.estado === 'DISPONIBLE' || l.estado === 'EN NEGOCIACIÓN') && permissions?.canManageArras && (
                              <button
                                className="btn btn-primary"
                                style={{ padding: '3px 8px', fontSize: 11, gap: 4, background: '#d97706', borderColor: '#d97706' }}
                                title="Separar lote con Arras"
                                onClick={() => setLoteParaArras(l)}
                              >
                                <BookmarkCheck size={11} /> Arras
                              </button>
                            )}
                            {(l.estado === 'DISPONIBLE' || l.estado === 'APARTADO' || l.estado === 'EN NEGOCIACIÓN') && permissions?.canGenerateContrato && (
                              <button
                                className="btn btn-primary"
                                style={{ padding: '3px 8px', fontSize: 11, gap: 4, background: '#2563eb', borderColor: '#2563eb' }}
                                title="Generar contrato de venta y descargar PDF"
                                onClick={() => setLoteParaContrato(l)}
                              >
                                <FileText size={11} /> Contrato
                              </button>
                            )}
                            {(l.estado === 'VENDIDO' || l.estado === 'PAGADO EN SU TOTALIDAD') && (
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '3px 8px', fontSize: 11, gap: 4, color: '#2563eb', border: '1px solid #bfdbfe' }}
                                title="Ver o descargar contrato"
                                onClick={() => handleVerContratoLote(l)}
                              >
                                <FileText size={11} /> Contrato
                              </button>
                            )}
                            {(l.estado === 'APARTADO' || l.estado === 'VENDIDO') && permissions?.canLiberarLote && (
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '3px 8px', fontSize: 11, gap: 4, color: '#dc2626', border: '1px solid #fecaca' }}
                                title="Liberar / Devolver a Disponible"
                                onClick={() => handleAbrirLiberarLote(l)}
                              >
                                <RotateCcw size={11} />
                              </button>
                            )}
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', fontSize: 12, gap: 4 }}
                              onClick={() => setSelected(l)}
                            >
                              <Eye size={12} /> Ver
                            </button>
                          </div>
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
            background: 'var(--bg-card2)',
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
                      background: isCurrent ? b.bg : 'var(--bg-card)',
                      color: isCurrent ? b.color : 'var(--text-secondary)',
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

          {(() => {
            const especial = obtenerBadgeCasoEspecial(selected.id_lote, casosEspeciales);
            if (!especial) return null;
            return (
              <div style={{
                marginTop: 16, padding: '12px 14px', borderRadius: 8,
                background: especial.bg, border: `1px solid ${especial.color}40`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span>{especial.icon || '📌'}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: especial.color }}>
                    CASO ESPECIAL: {especial.titulo || especial.text} ({especial.estado})
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {especial.rawCaso?.observacion}
                </div>
                {especial.monto > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: especial.color, marginTop: 4 }}>
                    Monto involucrado: {formatCOP(especial.monto)}
                  </div>
                )}
              </div>
            );
          })()}

          {selected.observacion && !obtenerBadgeCasoEspecial(selected.id_lote, casosEspeciales) && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-base)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                Observaciones:
              </div>
              <div style={{ fontSize: 13 }}>{selected.observacion}</div>
            </div>
          )}

          {historialDesist.length > 0 && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <History size={14} /> Histórico de Desistimientos / Liberaciones ({historialDesist.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {historialDesist.map((h) => (
                  <div key={h.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    padding: '6px 10px', borderRadius: 6, background: '#ffffff', border: '1px solid #ffedd5', fontSize: 11.5
                  }}>
                    <div>
                      <strong>{formatDate(h.fecha_liberacion)}</strong> · {h.cliente_nombre} ·{' '}
                      <span style={{ color: '#c2410c', fontWeight: 700 }}>Valor quitado: {formatCOP(h.valor_quitado)}</span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Motivo: {h.motivo}</div>
                    </div>
                    {h.venta_snapshot && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '3px 8px', fontSize: 11, color: '#c2410c', border: '1px solid #fdba74' }}
                        onClick={() => setDesistDetalleSnap(h)}
                      >
                        <Eye size={11} /> Ver detalle
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            {(selected.estado === 'DISPONIBLE' || selected.estado === 'EN NEGOCIACIÓN') && permissions?.canManageArras && (
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#d97706', borderColor: '#d97706' }}
                onClick={() => { setLoteParaArras(selected); setSelected(null); }}
              >
                <BookmarkCheck size={14} /> Generar Arras
              </button>
            )}
            {(selected.estado === 'DISPONIBLE' || selected.estado === 'APARTADO' || selected.estado === 'EN NEGOCIACIÓN') && permissions?.canGenerateContrato && (
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', borderColor: '#2563eb' }}
                onClick={() => { setLoteParaContrato(selected); setSelected(null); }}
              >
                <FileText size={14} /> Generar Contrato
              </button>
            )}
            {(selected.estado === 'VENDIDO' || selected.estado === 'PAGADO EN SU TOTALIDAD') && (
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb', borderColor: '#bfdbfe' }}
                onClick={() => handleVerContratoLote(selected)}
                disabled={loadingContrato}
              >
                <FileText size={13} /> Ver / Descargar Contrato
              </button>
            )}
            {(selected.estado === 'VENDIDO' || selected.estado === 'PAGADO EN SU TOTALIDAD' || selected.propietario) && (
              permissions?.canEditContrato ? (
                <button
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => handleEditarContratoLote(selected)}
                  disabled={loadingContrato}
                >
                  <Edit3 size={13} /> Editar Contrato / Titular
                </button>
              ) : null
            )}
            {(selected.estado === 'APARTADO' || selected.estado === 'VENDIDO') && permissions?.canLiberarLote && (
              <button
                className="btn btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', border: '1px solid #fecaca' }}
                onClick={() => { const l = selected; setSelected(null); handleAbrirLiberarLote(l); }}
              >
                <RotateCcw size={13} /> Devolver a Disponible
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {ventaParaEditar && (
        <ModalEditarContrato
          venta={ventaParaEditar}
          readOnly={!permissions?.canEditContrato}
          onClose={() => setVentaParaEditar(null)}
          onSuccess={() => {
            fetchLotes();
            setVentaParaEditar(null);
            setStatusMsg({ type: 'success', text: 'Contrato y titular actualizados con éxito.' });
            setTimeout(() => setStatusMsg(null), 4000);
          }}
        />
      )}

      {showModalNuevoLote && (
        <ModalNuevoLote
          existingLotes={allLotes}
          onClose={() => setShowModalNuevoLote(false)}
          onSuccess={(nuevo) => {
            setShowModalNuevoLote(false);
            fetchLotes();
            setStatusMsg({ type: 'success', text: `Lote ${nuevo.id_lote} creado exitosamente.` });
            setTimeout(() => setStatusMsg(null), 4000);
          }}
        />
      )}

      {showModalVenta && (
        <ModalRegistrarVenta
          preselectedLote={loteParaVenta}
          onClose={() => {
            setShowModalVenta(false);
            setLoteParaVenta(null);
          }}
          onSuccess={() => {
            setShowModalVenta(false);
            setLoteParaVenta(null);
            fetchLotes();
            setStatusMsg({ type: 'success', text: 'Venta registrada exitosamente y cuenta por cobrar generada.' });
            setTimeout(() => setStatusMsg(null), 5000);
          }}
        />
      )}

      {loteParaArras && (
        <ModalGenerarArras
          lote={loteParaArras}
          user={user}
          onClose={() => setLoteParaArras(null)}
          onSuccess={(res) => {
            fetchLotes();
            setStatusMsg({ type: 'success', text: `Arras generadas (Recibo #${res?.recibo?.numero_recibo}) y lote pasado a APARTADO / ARRAS.` });
            setTimeout(() => setStatusMsg(null), 5000);
          }}
        />
      )}

      {loteParaContrato && (
        <ModalGenerarContrato
          lote={loteParaContrato}
          user={user}
          onClose={() => setLoteParaContrato(null)}
          onSuccess={() => {
            fetchLotes();
            setStatusMsg({ type: 'success', text: 'Contrato generado, PDF descargado y lote pasado a VENDIDO.' });
            setTimeout(() => setStatusMsg(null), 5000);
          }}
        />
      )}

      {loteParaLiberar && (
        <ModalLiberarLote
          lote={loteParaLiberar.lote}
          venta={loteParaLiberar.venta}
          user={user}
          onClose={() => setLoteParaLiberar(null)}
          onSuccess={() => {
            fetchLotes();
            setStatusMsg({ type: 'success', text: 'Lote liberado a DISPONIBLE y guardado en el histórico de desistimientos.' });
            setTimeout(() => setStatusMsg(null), 5000);
          }}
        />
      )}

      {contratoParaVer && (
        <ModalVerContrato
          contrato={contratoParaVer}
          onClose={() => setContratoParaVer(null)}
        />
      )}

      {desistDetalleSnap && (
        <Modal
          title={`Histórico Desistimiento — ${desistDetalleSnap.id_lote} (${formatDate(desistDetalleSnap.fecha_liberacion)})`}
          onClose={() => setDesistDetalleSnap(null)}
          width="1100px"
        >
          <EstadoCuentaMatrizView
            venta={desistDetalleSnap.venta_snapshot}
            cuotas={desistDetalleSnap.cuotas_snapshot || []}
          />
        </Modal>
      )}

    </div>
  );
}
