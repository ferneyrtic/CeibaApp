import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Search, RefreshCw, Download, X,
  ShieldCheck, User, Calendar, Tag, ChevronDown, ChevronRight, Filter
} from 'lucide-react';
import Modal from './Modal';
import { getHistorialAcciones, exportarHistorialExcel } from '../lib/api/auditApi';

const MODULOS = ['Todos', 'ABONOS_EXTRAORDINARIOS', 'CASOS_ESPECIALES', 'CARTERA', 'LOTES', 'CUOTAS'];

function getActionBadge(accion) {
  if (!accion) return { label: 'Acción', bg: '#f1f5f9', color: '#475569' };
  const a = accion.toUpperCase();
  if (a.includes('AMORTIZACION')) {
    return { label: 'Amortización Extraordinaria', bg: '#dcfce7', color: '#15803d' };
  }
  if (a.includes('CASO_ESPECIAL')) {
    return { label: 'Caso Especial', bg: '#ede9fe', color: '#6d28d9' };
  }
  if (a.includes('ESTADO')) {
    return { label: 'Cambio de Estado', bg: '#fef3c7', color: '#b45309' };
  }
  if (a.includes('OBSERVACION')) {
    return { label: 'Observación', bg: '#e0f2fe', color: '#0369a1' };
  }
  return { label: accion, bg: '#f1f5f9', color: '#475569' };
}

export default function ModalHistorialAcciones({ onClose, loteFiltroInicial = '' }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(loteFiltroInicial);
  const [moduloFiltro, setModuloFiltro] = useState('Todos');
  const [expandedId, setExpandedId] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHistorialAcciones({ limit: 200 });
      setLogs(data || []);
    } catch (e) {
      console.error('Error cargando historial de acciones:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filtrado en memoria
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (moduloFiltro && moduloFiltro !== 'Todos') {
      result = result.filter(l => l.modulo === moduloFiltro);
    }

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      result = result.filter(l =>
        (l.descripcion && l.descripcion.toLowerCase().includes(s)) ||
        (l.lote_id_str && l.lote_id_str.toLowerCase().includes(s)) ||
        (l.cliente_nombre && l.cliente_nombre.toLowerCase().includes(s)) ||
        (l.usuario_nombre && l.usuario_nombre.toLowerCase().includes(s)) ||
        (l.usuario_email && l.usuario_email.toLowerCase().includes(s)) ||
        (l.accion && l.accion.toLowerCase().includes(s))
      );
    }

    return result;
  }, [logs, moduloFiltro, search]);

  const handleExportExcel = () => {
    exportarHistorialExcel(filteredLogs);
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ maxWidth: 950, width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: '#ecfdf5', color: '#059669',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                Registro de Acciones & Auditoría Operativa
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Trazabilidad completa de modificaciones, amortizaciones y abonos realizados
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: 34, width: '100%', fontSize: 12 }}
              placeholder="Buscar por lote, secretaria, cliente o acción..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={moduloFiltro}
            onChange={e => setModuloFiltro(e.target.value)}
            style={{ fontSize: 12, padding: '7px 12px' }}
          >
            {MODULOS.map(m => (
              <option key={m} value={m}>
                {m === 'Todos' ? 'Todos los Módulos' : m.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <button
            className="btn btn-ghost"
            onClick={fetchLogs}
            disabled={loading}
            title="Recargar logs"
            style={{ padding: '8px 12px', fontSize: 12 }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          <button
            className="btn btn-ghost"
            onClick={handleExportExcel}
            title="Descargar este historial en archivo Excel"
            style={{
              padding: '8px 14px', fontSize: 12, gap: 6,
              color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4', fontWeight: 700
            }}
          >
            <Download size={14} /> Exportar Excel
          </button>
        </div>

        {/* Resumen numérico */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>Mostrando <strong>{filteredLogs.length}</strong> eventos registrados</span>
          {search && <span>Filtro activo: "<strong>{search}</strong>"</span>}
        </div>

        {/* Listado de Logs */}
        <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando historial de acciones...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShieldCheck size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontWeight: 600 }}>No hay acciones registradas con los filtros seleccionados</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Cada vez que se amortice un abono o se actualice un caso, aparecerá aquí automáticamente.</div>
            </div>
          ) : (
            <div style={{ divideY: '1px solid var(--border)' }}>
              {filteredLogs.map(log => {
                const badge = getActionBadge(log.accion);
                const isExpanded = expandedId === log.id;
                const formattedDate = new Date(log.timestamp).toLocaleString('es-CO', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                });

                return (
                  <div
                    key={log.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: isExpanded ? 'var(--accent-soft)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                          background: badge.bg, color: badge.color
                        }}>
                          {badge.label}
                        </span>
                        {log.lote_id_str && log.lote_id_str !== '—' && (
                          <span style={{
                            fontFamily: 'monospace', fontWeight: 800, fontSize: 12,
                            background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#0f172a'
                          }}>
                            {log.lote_id_str}
                          </span>
                        )}
                        {log.cliente_nombre && log.cliente_nombre !== '—' && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            · {log.cliente_nombre}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={12} /> {log.usuario_nombre || log.usuario_email?.split('@')[0] || 'Secretaría'}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} /> {formattedDate}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {log.descripcion}
                    </div>

                    {/* Botón para ver detalles técnicos (si hay) */}
                    {log.detalles && Object.keys(log.detalles).length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          style={{
                            background: 'none', border: 'none', color: '#0284c7',
                            fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, padding: 0
                          }}
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {isExpanded ? 'Ocultar detalle técnico' : 'Ver detalle técnico / cuotas afectadas'}
                        </button>

                        {isExpanded && (
                          <pre style={{
                            marginTop: 8,
                            padding: 10,
                            background: '#0f172a',
                            color: '#94a3b8',
                            borderRadius: 6,
                            fontSize: 11,
                            overflowX: 'auto',
                            maxHeight: 180
                          }}>
                            {JSON.stringify(log.detalles, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 12 }}>
            Cerrar Historial
          </button>
        </div>
      </div>
    </Modal>
  );
}
