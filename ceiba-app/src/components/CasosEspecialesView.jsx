import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle, Clock, CheckCircle2, Search, Plus, Edit2,
  Trash2, Download, RefreshCw, X, ArrowRight, FileText,
  DollarSign, MessageSquare, Tag, Eye, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  getCasosEspeciales, guardarCasoEspecial, eliminarCasoEspecial,
  agregarNotaSeguimiento, exportarCasosEspecialesExcel,
  CATEGORIAS_CASOS, ESTADOS_CASOS
} from '../lib/api/casosEspecialesApi';
import { formatCOP, formatDate } from '../utils/helpers';
import Modal from './Modal';

export default function CasosEspecialesView({ onOpenEstadoCuenta, usuarioActual }) {
  const [casos, setCasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // Modales
  const [casoParaEditar, setCasoParaEditar] = useState(null);
  const [mostrarModalCrearEditar, setMostrarModalCrearEditar] = useState(false);
  const [casoParaNota, setCasoParaNota] = useState(null);
  const [textoNuevaNota, setTextoNuevaNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [expandedNotasId, setExpandedNotasId] = useState(null);

  const fetchCasos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCasosEspeciales();
      setCasos(data || []);
    } catch (e) {
      console.error('Error cargando casos especiales:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCasos();
  }, [fetchCasos]);

  // Contadores y KPIs
  const stats = useMemo(() => {
    const total = casos.length;
    const enTramite = casos.filter(c => c.estado === 'EN_TRAMITE').length;
    const bloqueados = casos.filter(c => c.estado === 'BLOQUEADO').length;
    const dacion = casos.filter(c => c.categoria === 'PARTE_DE_PAGO').length;
    const traslado = casos.filter(c => c.categoria === 'TRASLADO_DINERO').length;
    const resueltos = casos.filter(c => c.estado === 'RESUELTO').length;
    const sumaMontos = casos.reduce((acc, c) => acc + (Number(c.monto_asociado) || 0), 0);

    return { total, enTramite, bloqueados, dacion, traslado, resueltos, sumaMontos };
  }, [casos]);

  // Filtrado reactivo en memoria
  const casosFiltrados = useMemo(() => {
    let result = casos;

    if (filtroCategoria !== 'Todos') {
      result = result.filter(c => c.categoria === filtroCategoria);
    }

    if (filtroEstado !== 'Todos') {
      result = result.filter(c => c.estado === filtroEstado);
    }

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      result = result.filter(c =>
        (c.id_lote && c.id_lote.toLowerCase().includes(s)) ||
        (c.cliente && c.cliente.toLowerCase().includes(s)) ||
        (c.titulo && c.titulo.toLowerCase().includes(s)) ||
        (c.observacion && c.observacion.toLowerCase().includes(s)) ||
        (c.lote_destino && c.lote_destino.toLowerCase().includes(s))
      );
    }

    return result;
  }, [casos, filtroCategoria, filtroEstado, search]);

  const handleCrearNuevo = () => {
    setCasoParaEditar({
      id: '',
      id_lote: '',
      cliente: '',
      categoria: 'PARTE_DE_PAGO',
      estado: 'EN_TRAMITE',
      titulo: '',
      monto_asociado: 0,
      lote_destino: '',
      observacion: ''
    });
    setMostrarModalCrearEditar(true);
  };

  const handleEditar = (caso) => {
    setCasoParaEditar({ ...caso });
    setMostrarModalCrearEditar(true);
  };

  const handleGuardarCaso = async (formData) => {
    try {
      await guardarCasoEspecial(formData, usuarioActual);
      setMostrarModalCrearEditar(false);
      setCasoParaEditar(null);
      await fetchCasos();
    } catch (e) {
      alert('Error guardando caso especial: ' + (e.message || e));
    }
  };

  const handleEliminar = async (id, idLote) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el caso especial del lote ${idLote}?`)) return;
    try {
      await eliminarCasoEspecial(id, usuarioActual);
      await fetchCasos();
    } catch (e) {
      alert('Error al eliminar caso: ' + (e.message || e));
    }
  };

  const handleAbrirNota = (caso) => {
    setCasoParaNota(caso);
    setTextoNuevaNota('');
  };

  const handleGuardarNota = async () => {
    if (!textoNuevaNota.trim() || !casoParaNota) return;
    setGuardandoNota(true);
    try {
      await agregarNotaSeguimiento(casoParaNota.id, textoNuevaNota.trim(), usuarioActual);
      setCasoParaNota(null);
      setTextoNuevaNota('');
      await fetchCasos();
    } catch (e) {
      alert('Error agregando nota: ' + (e.message || e));
    } finally {
      setGuardandoNota(false);
    }
  };

  const handleCambiarEstadoRapido = async (caso, nuevoEstado) => {
    try {
      await guardarCasoEspecial({ ...caso, estado: nuevoEstado }, usuarioActual);
      await fetchCasos();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      {/* Header del Espacio */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📌 Casos Especiales & Observaciones de Cartera</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Control y seguimiento prioritario de dación en pago, permutas, dinero en tránsito y acuerdos atípicos
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={fetchCasos}
            disabled={loading}
            title="Recargar casos especiales"
            style={{ fontSize: 12, padding: '8px 12px' }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => exportarCasosEspecialesExcel(casosFiltrados)}
            style={{ fontSize: 12, gap: 6, color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4', fontWeight: 700 }}
          >
            <Download size={14} /> Exportar Excel
          </button>

          <button
            className="btn btn-primary"
            onClick={handleCrearNuevo}
            style={{ fontSize: 12, gap: 6, fontWeight: 700 }}
          >
            <Plus size={15} /> Nuevo Caso Especial
          </button>
        </div>
      </div>

      {/* KPI Cards Superiores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="kpi-card green" style={{ padding: '12px 14px' }}>
          <div className="kpi-value" style={{ fontSize: 20 }}>{stats.total}</div>
          <div className="kpi-label">Total Casos Registrados</div>
          <div className="kpi-change" style={{ color: '#16a34a' }}>{formatCOP(stats.sumaMontos)} involucrados</div>
        </div>

        <div className="kpi-card yellow" style={{ padding: '12px 14px' }}>
          <div className="kpi-value" style={{ fontSize: 20 }}>{stats.enTramite}</div>
          <div className="kpi-label">En Trámite Activo</div>
          <div className="kpi-change" style={{ color: '#d97706' }}>Requieren seguimiento</div>
        </div>

        <div className="kpi-card purple" style={{ padding: '12px 14px', background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.2)' }}>
          <div className="kpi-value" style={{ fontSize: 20, color: '#6d28d9' }}>{stats.dacion}</div>
          <div className="kpi-label">Dación en Pago / Permuta</div>
          <div className="kpi-change" style={{ color: '#6d28d9' }}>Vehículos y bienes</div>
        </div>

        <div className="kpi-card blue" style={{ padding: '12px 14px' }}>
          <div className="kpi-value" style={{ fontSize: 20 }}>{stats.traslado}</div>
          <div className="kpi-label">Traslados de Fondos</div>
          <div className="kpi-change" style={{ color: '#0284c7' }}>Dinero en tránsito</div>
        </div>

        <div className="kpi-card green" style={{ padding: '12px 14px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)' }}>
          <div className="kpi-value" style={{ fontSize: 20, color: '#16a34a' }}>{stats.resueltos}</div>
          <div className="kpi-label">Casos Resueltos</div>
          <div className="kpi-change" style={{ color: '#16a34a' }}>Legalizados con éxito</div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="search-bar" style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="search-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar por lote, cliente, permuta, dinero en tránsito..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
        >
          <option value="Todos">Todas las Categorías</option>
          {CATEGORIAS_CASOS.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="Todos">Todos los Estados</option>
          {ESTADOS_CASOS.map(e => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>
      </div>

      {/* Listado de Casos */}
      {loading ? (
        <div style={{ padding: 50, textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
          Cargando casos especiales...
        </div>
      ) : casosFiltrados.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <Tag size={36} style={{ margin: '0 auto 10px', color: 'var(--text-muted)', opacity: 0.5 }} />
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>No se encontraron casos con los filtros aplicados</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Haz clic en "Nuevo Caso Especial" para vincular un lote en dación en pago o traslado de dinero.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {casosFiltrados.map(caso => {
            const cat = CATEGORIAS_CASOS.find(c => c.id === caso.categoria) || CATEGORIAS_CASOS[0];
            const est = ESTADOS_CASOS.find(e => e.id === caso.estado) || ESTADOS_CASOS[0];
            const isNotasExpanded = expandedNotasId === caso.id;
            const tieneNotas = caso.historial_notas && caso.historial_notas.length > 0;

            return (
              <div
                key={caso.id}
                style={{
                  background: 'var(--bg-card)',
                  border: `1.5px solid ${caso.estado === 'BLOQUEADO' ? '#fca5a5' : caso.estado === 'RESUELTO' ? '#86efac' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s'
                }}
              >
                <div>
                  {/* Fila Superior: Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{
                        background: cat.bg, color: cat.color,
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}>
                        <span>{cat.icon}</span> {cat.label}
                      </span>
                    </div>

                    <select
                      value={caso.estado}
                      onChange={e => handleCambiarEstadoRapido(caso, e.target.value)}
                      style={{
                        background: est.bg,
                        color: est.color,
                        border: `1px solid ${est.color}50`,
                        borderRadius: 14,
                        padding: '2px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                      title="Cambiar estado del caso"
                    >
                      {ESTADOS_CASOS.map(e => (
                        <option key={e.id} value={e.id}>{e.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Identificador de Lote y Título */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: 'monospace', fontWeight: 900, fontSize: 15,
                      background: 'var(--accent-soft)', color: 'var(--accent)',
                      padding: '2px 8px', borderRadius: 6
                    }}>
                      {caso.id_lote}
                    </span>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>
                      {caso.titulo}
                    </div>
                  </div>

                  {/* Cliente */}
                  {caso.cliente && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Titular: <strong style={{ color: 'var(--text-secondary)' }}>{caso.cliente}</strong>
                    </div>
                  )}

                  {/* Cuadro de Información Financiera / Traslado */}
                  {(caso.monto_asociado > 0 || caso.lote_destino) && (
                    <div style={{
                      background: 'var(--bg-base)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      marginBottom: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      fontSize: 12
                    }}>
                      {caso.monto_asociado > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Monto: </span>
                          <strong style={{ color: '#0284c7', fontWeight: 800 }}>
                            {formatCOP(caso.monto_asociado)}
                          </strong>
                        </div>
                      )}

                      {caso.lote_destino && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#b45309', fontWeight: 700 }}>
                          <ArrowRight size={13} />
                          <span>Destino: {caso.lote_destino}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Observación Principal */}
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 12 }}>
                    {caso.observacion}
                  </div>

                  {/* Sección de Notas de Seguimiento */}
                  {tieneNotas && (
                    <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, marginBottom: 10 }}>
                      <div
                        onClick={() => setExpandedNotasId(isNotasExpanded ? null : caso.id)}
                        style={{
                          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MessageSquare size={12} /> {caso.historial_notas.length} notas de avance
                        </span>
                        {isNotasExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </div>

                      {isNotasExpanded && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {caso.historial_notas.map((n, i) => (
                            <div key={i} style={{ background: 'var(--bg-base)', padding: '6px 10px', borderRadius: 6, fontSize: 11 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 2 }}>
                                <span>{n.autor || 'Secretaría'}</span>
                                <span>{n.fecha}</span>
                              </div>
                              <div style={{ color: 'var(--text-primary)' }}>{n.nota}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botonera de Acciones del Caso */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleAbrirNota(caso)}
                      style={{ padding: '4px 8px', fontSize: 11, gap: 4 }}
                      title="Agregar nota de avance"
                    >
                      <Plus size={12} /> Nota
                    </button>

                    <button
                      className="btn btn-ghost"
                      onClick={() => handleEditar(caso)}
                      style={{ padding: '4px 8px', fontSize: 11, gap: 4 }}
                      title="Editar caso"
                    >
                      <Edit2 size={12} /> Editar
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {onOpenEstadoCuenta && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => onOpenEstadoCuenta(caso.id_lote)}
                        style={{ padding: '4px 10px', fontSize: 11, gap: 4, color: '#0369a1', borderColor: '#bae6fd' }}
                        title="Ver extracto / estado de cuenta del lote"
                      >
                        <Eye size={12} /> Extracto
                      </button>
                    )}

                    <button
                      className="btn btn-ghost"
                      onClick={() => handleEliminar(caso.id, caso.id_lote)}
                      style={{ padding: '4px 6px', fontSize: 11, color: '#dc2626' }}
                      title="Eliminar caso"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Caso */}
      {mostrarModalCrearEditar && casoParaEditar && (
        <ModalCrearEditarCaso
          caso={casoParaEditar}
          onClose={() => setMostrarModalCrearEditar(false)}
          onGuardar={handleGuardarCaso}
        />
      )}

      {/* Modal Agregar Nota de Avance */}
      {casoParaNota && (
        <Modal onClose={() => setCasoParaNota(null)}>
          <div style={{ maxWidth: 450 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              💬 Agregar Nota de Seguimiento
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Lote: <strong style={{ fontFamily: 'monospace' }}>{casoParaNota.id_lote}</strong> — {casoParaNota.titulo}
            </div>

            <textarea
              className="search-input"
              style={{ width: '100%', height: 100, padding: 10, fontSize: 13, resize: 'vertical' }}
              placeholder="Escribe la novedad (ej. 'El cliente entregó la copia del peritaje vehicular...', 'Se aprobó el cruce contable de $6.000.000...')"
              value={textoNuevaNota}
              onChange={e => setTextoNuevaNota(e.target.value)}
              autoFocus
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setCasoParaNota(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGuardarNota}
                disabled={guardandoNota || !textoNuevaNota.trim()}
              >
                {guardandoNota ? 'Guardando...' : 'Guardar Nota'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ModalCrearEditarCaso({ caso, onClose, onGuardar }) {
  const [form, setForm] = useState({ ...caso });
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.id_lote.trim() || !form.titulo.trim()) {
      alert('Por favor indica el ID de Lote y el Título del caso.');
      return;
    }
    setGuardando(true);
    await onGuardar(form);
    setGuardando(false);
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
          {form.id ? '✏️ Modificar Caso Especial' : '➕ Registrar Nuevo Caso Especial'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Asocia una condición atípica (dación en pago, traslado de fondos, etc.) a un lote
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              ID LOTE *
            </label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%', fontFamily: 'monospace', fontWeight: 700 }}
              placeholder="Ej: LC2 - 28 - 2"
              value={form.id_lote}
              onChange={e => setForm({ ...form, id_lote: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              CATEGORÍA *
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={form.categoria}
              onChange={e => setForm({ ...form, categoria: e.target.value })}
            >
              {CATEGORIAS_CASOS.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            TÍTULO / ASUNTO DEL CASO *
          </label>
          <input
            type="text"
            className="search-input"
            style={{ width: '100%' }}
            placeholder="Ej: Permuta Parcial Vehicular, Dinero en Tránsito $6M..."
            value={form.titulo}
            onChange={e => setForm({ ...form, titulo: e.target.value })}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              NOMBRE DEL CLIENTE
            </label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              placeholder="Nombre del comprador"
              value={form.cliente || ''}
              onChange={e => setForm({ ...form, cliente: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              ESTADO DEL CASO
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={form.estado}
              onChange={e => setForm({ ...form, estado: e.target.value })}
            >
              {ESTADOS_CASOS.map(e => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              MONTO ASOCIADO ($ COP)
            </label>
            <input
              type="number"
              className="search-input"
              style={{ width: '100%' }}
              placeholder="Ej: 6000000"
              value={form.monto_asociado || ''}
              onChange={e => setForm({ ...form, monto_asociado: Number(e.target.value) || 0 })}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              LOTE DESTINO (Si aplica traslado)
            </label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%', fontFamily: 'monospace' }}
              placeholder="Ej: LC2 - 41 - 16"
              value={form.lote_destino || ''}
              onChange={e => setForm({ ...form, lote_destino: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            DETALLE Y OBSERVACIONES *
          </label>
          <textarea
            className="search-input"
            style={{ width: '100%', height: 90, padding: 10, fontSize: 12, resize: 'vertical' }}
            placeholder="Describe detalladamente el acuerdo, las condiciones de la permuta o el procedimiento contable..."
            value={form.observacion || ''}
            onChange={e => setForm({ ...form, observacion: e.target.value })}
            required
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? 'Guardando...' : form.id ? 'Guardar Cambios' : 'Registrar Caso'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
