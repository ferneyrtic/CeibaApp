import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  HardHat, Plus, Search, Filter, Download, FileText, Trash2, Edit2,
  DollarSign, Calendar, Tag, CheckCircle2, AlertTriangle, Eye, RefreshCw,
  Building2, Truck, Wrench, ShieldCheck, ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getGastos, guardarGasto, eliminarGasto,
  CATEGORIAS_GASTOS, MEDIOS_PAGO_GASTOS,
  exportarGastosExcel, exportarGastosPDF
} from '../lib/api/gastosApi';
import { formatCOP, formatDate } from '../utils/helpers';
import Modal from '../components/Modal';

export default function Gastos() {
  const { user, permissions, role } = useAuth();
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes_actual'); // 'mes_actual', 'mes_anterior', 'ano_actual', 'todos'

  // Modales
  const [showModalCrear, setShowModalCrear] = useState(false);
  const [gastoParaEditar, setGastoParaEditar] = useState(null);
  const [gastoParaVer, setGastoParaVer] = useState(null);

  // Form State
  const [formFecha, setFormFecha] = useState(new Date().toISOString().slice(0, 10));
  const [formCategoria, setFormCategoria] = useState('MATERIALES');
  const [formConcepto, setFormConcepto] = useState('');
  const [formProveedor, setFormProveedor] = useState('');
  const [formFactura, setFormFactura] = useState('');
  const [formMedioPago, setFormMedioPago] = useState('TRANSFERENCIA');
  const [formBanco, setFormBanco] = useState('Bancolombia');
  const [formReferencia, setFormReferencia] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const fetchGastos = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const data = await getGastos(force);
      setGastos(data || []);
    } catch (err) {
      console.error('Error cargando gastos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  // Filtrado de gastos
  const gastosFiltrados = useMemo(() => {
    const hoy = new Date();
    const anoActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1; // 1-12

    return gastos.filter(g => {
      // 1. Filtro Categoría
      if (filtroCategoria !== 'Todos' && g.categoria !== filtroCategoria) {
        return false;
      }

      // 2. Filtro Período
      const fGasto = g.fecha || (g.created_at ? g.created_at.slice(0, 10) : '');
      if (filtroPeriodo === 'mes_actual' && fGasto) {
        const [y, m] = fGasto.split('-').map(Number);
        if (y !== anoActual || m !== mesActual) return false;
      } else if (filtroPeriodo === 'mes_anterior' && fGasto) {
        const mesAnt = mesActual === 1 ? 12 : mesActual - 1;
        const anoAnt = mesActual === 1 ? anoActual - 1 : anoActual;
        const [y, m] = fGasto.split('-').map(Number);
        if (y !== anoAnt || m !== mesAnt) return false;
      } else if (filtroPeriodo === 'ano_actual' && fGasto) {
        const [y] = fGasto.split('-').map(Number);
        if (y !== anoActual) return false;
      }

      // 3. Filtro Búsqueda
      if (search.trim()) {
        const s = search.toLowerCase();
        const texto = `${g.concepto || ''} ${g.proveedor || ''} ${g.numero_factura || ''} ${g.banco || ''} ${g.referencia || ''} ${g.observaciones || ''}`.toLowerCase();
        if (!texto.includes(s)) return false;
      }

      return true;
    });
  }, [gastos, filtroCategoria, filtroPeriodo, search]);

  // KPIs
  const kpis = useMemo(() => {
    const total = gastosFiltrados.reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
    const count = gastosFiltrados.length;

    // Desglose por categorías clave
    const totalMateriales = gastosFiltrados
      .filter(g => g.categoria === 'MATERIALES')
      .reduce((acc, g) => acc + (Number(g.valor) || 0), 0);

    const totalManoObra = gastosFiltrados
      .filter(g => g.categoria === 'MANO_OBRA')
      .reduce((acc, g) => acc + (Number(g.valor) || 0), 0);

    const totalMaquinaria = gastosFiltrados
      .filter(g => g.categoria === 'MAQUINARIA')
      .reduce((acc, g) => acc + (Number(g.valor) || 0), 0);

    return { total, count, totalMateriales, totalManoObra, totalMaquinaria };
  }, [gastosFiltrados]);

  // Abrir Modal Crear
  const handleOpenCrear = () => {
    setGastoParaEditar(null);
    setFormFecha(new Date().toISOString().slice(0, 10));
    setFormCategoria('MATERIALES');
    setFormConcepto('');
    setFormProveedor('');
    setFormFactura('');
    setFormMedioPago('TRANSFERENCIA');
    setFormBanco('Bancolombia');
    setFormReferencia('');
    setFormValor('');
    setFormObservaciones('');
    setErrorForm('');
    setShowModalCrear(true);
  };

  // Abrir Modal Editar
  const handleOpenEditar = (gasto) => {
    setGastoParaEditar(gasto);
    setFormFecha(gasto.fecha || new Date().toISOString().slice(0, 10));
    setFormCategoria(gasto.categoria || 'MATERIALES');
    setFormConcepto(gasto.concepto || '');
    setFormProveedor(gasto.proveedor || '');
    setFormFactura(gasto.numero_factura || '');
    setFormMedioPago(gasto.medio_pago || 'TRANSFERENCIA');
    setFormBanco(gasto.banco || 'Bancolombia');
    setFormReferencia(gasto.referencia || '');
    setFormValor(gasto.valor ? String(gasto.valor) : '');
    setFormObservaciones(gasto.observaciones || '');
    setErrorForm('');
    setShowModalCrear(true);
  };

  // Guardar Gasto
  const handleGuardar = async (e) => {
    e.preventDefault();
    setErrorForm('');

    const valNum = Number(formValor.replace(/[^0-9]/g, ''));
    if (!valNum || valNum <= 0) {
      setErrorForm('Por favor ingresa un monto válido mayor a cero.');
      return;
    }

    if (!formConcepto.trim()) {
      setErrorForm('Por favor ingresa el concepto o detalle del gasto.');
      return;
    }

    setGuardando(true);
    try {
      await guardarGasto({
        ...(gastoParaEditar ? { id: gastoParaEditar.id, db_id: gastoParaEditar.db_id } : {}),
        fecha: formFecha,
        categoria: formCategoria,
        concepto: formConcepto.trim(),
        proveedor: formProveedor.trim(),
        numero_factura: formFactura.trim(),
        medio_pago: formMedioPago,
        banco: formMedioPago === 'TRANSFERENCIA' ? formBanco : '',
        referencia: formReferencia.trim(),
        valor: valNum,
        observaciones: formObservaciones.trim(),
        registrado_por: user?.user_metadata?.nombre || user?.email || 'Propietario'
      }, user?.user_metadata?.nombre || 'Propietario');

      setShowModalCrear(false);
      setGastoParaEditar(null);
      await fetchGastos(true);
    } catch (err) {
      setErrorForm(err.message || 'Error al guardar el gasto');
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar Gasto
  const handleEliminar = async (id, concepto) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar este gasto?\n\n"${concepto}"`)) return;

    try {
      await eliminarGasto(id, user?.user_metadata?.nombre || user?.email || 'Propietario');
      await fetchGastos(true);
    } catch (err) {
      alert('Error eliminando el gasto: ' + (err.message || err));
    }
  };

  const getCatObj = (catId) => CATEGORIAS_GASTOS.find(c => c.id === catId) || {
    label: catId, shortLabel: catId, icon: '📦', color: '#64748b', bg: '#f1f5f9'
  };

  const periodoLabel = {
    mes_actual: 'Mes Actual',
    mes_anterior: 'Mes Anterior',
    ano_actual: 'Año 2026',
    todos: 'Histórico Total'
  }[filtroPeriodo] || 'Período';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 40 }}>
      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #b45309, #d97706)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <HardHat size={22} />
            </div>
            <div>
              <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Gastos de Obra & Operación
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#fef3c7', color: '#b45309', fontWeight: 800 }}>
                  PROPIETARIO & GERENCIA
                </span>
              </div>
              <div className="page-subtitle">
                Control contable de materiales de construcción, maquinaria, mano de obra y costos de desarrollo del proyecto
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={() => exportarGastosExcel(gastosFiltrados, `Gastos_La_Ceiba_${filtroPeriodo}`)}
            title="Exportar a Excel"
            style={{ fontSize: 13, gap: 6 }}
          >
            <Download size={15} /> Excel
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => exportarGastosPDF(gastosFiltrados, kpis, periodoLabel)}
            title="Exportar a PDF oficial"
            style={{ fontSize: 13, gap: 6 }}
          >
            <FileText size={15} /> PDF
          </button>

          <button
            className="btn btn-primary"
            onClick={handleOpenCrear}
            style={{ fontSize: 13, gap: 6, background: '#b45309', borderColor: '#b45309', fontWeight: 700 }}
          >
            <Plus size={16} /> + Registrar Gasto de Obra
          </button>
        </div>
      </div>

      {/* KPIS CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Total Gastos */}
        <div className="card" style={{ padding: 18, borderLeft: '4px solid #b45309' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Egresos ({periodoLabel})
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: '#fef3c7', color: '#b45309' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#b45309', marginTop: 8 }}>
            {formatCOP(kpis.total)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {kpis.count} registro{kpis.count === 1 ? '' : 's'} de gasto ejecutados
          </div>
        </div>

        {/* Materiales */}
        <div className="card" style={{ padding: 18, borderLeft: '4px solid #16a34a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              🧱 Materiales (Cemento/Arena)
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: '#dcfce7', color: '#16a34a' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginTop: 8 }}>
            {formatCOP(kpis.totalMateriales)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {kpis.total > 0 ? `${Math.round((kpis.totalMateriales / kpis.total) * 100)}% del total` : '0%'}
          </div>
        </div>

        {/* Maquinaria */}
        <div className="card" style={{ padding: 18, borderLeft: '4px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              🚜 Maquinaria & ACPM
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: '#ffedd5', color: '#ea580c' }}>
              <Truck size={18} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#c2410c', marginTop: 8 }}>
            {formatCOP(kpis.totalMaquinaria)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {kpis.total > 0 ? `${Math.round((kpis.totalMaquinaria / kpis.total) * 100)}% del total` : '0%'}
          </div>
        </div>

        {/* Mano de Obra */}
        <div className="card" style={{ padding: 18, borderLeft: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              👷 Mano de Obra / Nómina
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: '#eff6ff', color: '#2563eb' }}>
              <Wrench size={18} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8', marginTop: 8 }}>
            {formatCOP(kpis.totalManoObra)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {kpis.total > 0 ? `${Math.round((kpis.totalManoObra / kpis.total) * 100)}% del total` : '0%'}
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Búsqueda */}
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por concepto, proveedor, factura o referencia..."
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          {/* Filtro Período */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} color="var(--text-muted)" />
            <select
              className="input"
              value={filtroPeriodo}
              onChange={e => setFiltroPeriodo(e.target.value)}
              style={{ fontSize: 13, padding: '7px 12px' }}
            >
              <option value="mes_actual">📅 Mes Actual (Septiembre 2026)</option>
              <option value="mes_anterior">📅 Mes Anterior (Agosto 2026)</option>
              <option value="ano_actual">📅 Todo el Año 2026</option>
              <option value="todos">📅 Todo el Histórico</option>
            </select>
          </div>

          {/* Filtro Categoría */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={15} color="var(--text-muted)" />
            <select
              className="input"
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              style={{ fontSize: 13, padding: '7px 12px' }}
            >
              <option value="Todos">Todas las Categorías</option>
              {CATEGORIAS_GASTOS.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.shortLabel}</option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-ghost"
            onClick={() => fetchGastos(true)}
            title="Recargar datos"
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* TABLA DE GASTOS */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
            Cargando gastos de obra...
          </div>
        ) : gastosFiltrados.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧱</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              No se encontraron gastos en este período
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 450, margin: '6px auto 16px' }}>
              Registra los desembolsos de obra, compras de cemento, horas de máquina o jornales para llevar el control financiero.
            </div>
            <button className="btn btn-primary" onClick={handleOpenCrear} style={{ background: '#b45309', borderColor: '#b45309' }}>
              <Plus size={15} /> Registrar Primer Gasto
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Categoría</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Concepto & Detalle</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Proveedor / Beneficiario</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Soporte / Factura</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Medio de Pago</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Valor ($ COP)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gastosFiltrados.map((g, idx) => {
                  const cat = getCatObj(g.categoria);
                  return (
                    <tr
                      key={g.id || idx}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {formatDate(g.fecha)}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: cat.bg,
                          color: cat.color,
                          fontWeight: 700,
                          fontSize: 11.5,
                          border: `1px solid ${cat.color}30`
                        }}>
                          <span>{cat.icon}</span>
                          <span>{cat.shortLabel}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: 360 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {g.concepto}
                        </div>
                        {g.observaciones && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {g.observaciones}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {g.proveedor || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {g.numero_factura ? (
                          <span style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--bg-muted)', padding: '2px 6px', borderRadius: 4 }}>
                            {g.numero_factura}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{g.medio_pago || 'TRANSFERENCIA'}</div>
                        {g.banco && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{g.banco}</div>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#b45309', fontSize: 13.5, whiteSpace: 'nowrap' }}>
                        {formatCOP(g.valor)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => setGastoParaVer(g)}
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            title="Ver detalle del gasto"
                          >
                            <Eye size={13} />
                          </button>

                          <button
                            className="btn btn-ghost"
                            onClick={() => handleOpenEditar(g)}
                            style={{ padding: '4px 8px', fontSize: 11, color: '#0284c7' }}
                            title="Editar este gasto"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            className="btn btn-ghost"
                            onClick={() => handleEliminar(g.id, g.concepto)}
                            style={{ padding: '4px 8px', fontSize: 11, color: '#dc2626' }}
                            title="Eliminar este gasto"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR / EDITAR GASTO */}
      {showModalCrear && (
        <Modal
          title={gastoParaEditar ? "✏️ Editar Gasto de Obra" : "🧱 Registrar Gasto de Obra & Operación"}
          onClose={() => setShowModalCrear(false)}
        >
          <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {errorForm && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12.5 }}>
                {errorForm}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>Fecha del Gasto *</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={formFecha}
                  onChange={e => setFormFecha(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>Categoría *</label>
                <select
                  className="input"
                  value={formCategoria}
                  onChange={e => setFormCategoria(e.target.value)}
                  required
                >
                  {CATEGORIAS_GASTOS.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>Concepto / Detalle del Gasto *</label>
              <textarea
                className="input"
                rows={2}
                required
                placeholder="Ej: Compra de 80 bultos de cemento gris Argos para la vía principal..."
                value={formConcepto}
                onChange={e => setFormConcepto(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>Proveedor / Beneficiario</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Ferretería El Progreso"
                  value={formProveedor}
                  onChange={e => setFormProveedor(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>Nº Factura / Cuenta de Cobro</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: FAC-12903 ó CC-45"
                  value={formFactura}
                  onChange={e => setFormFactura(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>Medio de Pago</label>
                <select
                  className="input"
                  value={formMedioPago}
                  onChange={e => setFormMedioPago(e.target.value)}
                >
                  {MEDIOS_PAGO_GASTOS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>Banco / Origen</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Bancolombia"
                  value={formBanco}
                  onChange={e => setFormBanco(e.target.value)}
                  disabled={formMedioPago === 'EFECTIVO'}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>Nº Referencia / Aprobación</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: TR-891230"
                  value={formReferencia}
                  onChange={e => setFormReferencia(e.target.value)}
                />
              </div>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14 }}>
              <label className="label" style={{ fontSize: 12, fontWeight: 800, color: '#92400e' }}>
                Valor Total del Gasto ($ COP) *
              </label>
              <div style={{ position: 'relative', marginTop: 4 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#b45309' }}>
                  $
                </span>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="0"
                  value={formValor ? Number(formValor.replace(/[^0-9]/g, '')).toLocaleString('es-CO') : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setFormValor(raw);
                  }}
                  style={{
                    paddingLeft: 28, fontSize: 18, fontWeight: 800, color: '#b45309',
                    fontFamily: 'Inter, sans-serif'
                  }}
                />
              </div>
            </div>

            <div>
              <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>Observaciones / Notas Adicionales</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Detalles sobre entrega en obra, personal que recibió o autorizó..."
                value={formObservaciones}
                onChange={e => setFormObservaciones(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowModalCrear(false)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={guardando}
                style={{ background: '#b45309', borderColor: '#b45309', fontWeight: 700 }}
              >
                {guardando ? 'Guardando...' : (gastoParaEditar ? 'Actualizar Gasto' : 'Guardar Gasto')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL VER DETALLE DE GASTO */}
      {gastoParaVer && (
        <Modal title="📄 Comprobante de Gasto de Obra" onClose={() => setGastoParaVer(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a'
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>
                  Valor del Desembolso
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#b45309' }}>
                  {formatCOP(gastoParaVer.valor)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fecha</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{formatDate(gastoParaVer.fecha)}</div>
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label">Categoría</div>
                <div className="detail-value">{getCatObj(gastoParaVer.categoria).label}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Proveedor / Beneficiario</div>
                <div className="detail-value">{gastoParaVer.proveedor || 'No especificado'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Nº Factura / Soporte</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{gastoParaVer.numero_factura || 'Sin soporte'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Medio de Pago</div>
                <div className="detail-value">{gastoParaVer.medio_pago || 'TRANSFERENCIA'} {gastoParaVer.banco ? `(${gastoParaVer.banco})` : ''}</div>
              </div>
              {gastoParaVer.referencia && (
                <div className="detail-item">
                  <div className="detail-label">Referencia / Aprobación</div>
                  <div className="detail-value">{gastoParaVer.referencia}</div>
                </div>
              )}
              <div className="detail-item">
                <div className="detail-label">Registrado Por</div>
                <div className="detail-value">{gastoParaVer.registrado_por || 'Propietario'}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                Concepto / Descripción:
              </div>
              <div style={{ background: 'var(--bg-muted)', padding: '10px 14px', borderRadius: 8, fontSize: 13, lineHeight: 1.4 }}>
                {gastoParaVer.concepto}
              </div>
            </div>

            {gastoParaVer.observaciones && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Observaciones Adicionales:
                </div>
                <div style={{ background: 'var(--bg-muted)', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {gastoParaVer.observaciones}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => setGastoParaVer(null)}>Cerrar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
