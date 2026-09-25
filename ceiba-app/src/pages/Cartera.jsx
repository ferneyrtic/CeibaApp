import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle, Clock, CheckCircle2, Search,
  RefreshCw, DollarSign, TrendingUp, Users, FileText, X,
  Plus, Edit2, Download, Table, Calendar, ArrowRight, ShieldAlert, Zap,
  ShieldCheck, Tag, Receipt
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { getCartera, getCarteraStats, getCuotasByVenta, clearCarteraCache } from '../lib/api/cartera';
import { formatCOP, formatDate } from '../utils/helpers';
import { exportEstadoCuentaMatrizPDF, exportEstadoCuentaInformePDF, exportEstadoCuentaPDF } from '../utils/exportEstadoCuenta';
import EstadoCuentaMatrizView from '../components/EstadoCuentaMatrizView';
import AbonosExtraordinariosView from '../components/AbonosExtraordinariosView';
import CasosEspecialesView from '../components/CasosEspecialesView';
import ModalHistorialAcciones from '../components/ModalHistorialAcciones';
import { getCasosEspeciales, obtenerBadgeCasoEspecial } from '../lib/api/casosEspecialesApi';
import Modal from '../components/Modal';
import ModalEditarCuota from '../components/ModalEditarCuota';
import ModalEditarContrato from '../components/ModalEditarContrato';
import ModalRegistrarPagoRecibo from '../components/ModalRegistrarPagoRecibo';
import ReciboCajaView from '../components/ReciboCajaView';
import { obtenerRecibosPorVenta } from '../lib/api/recibosApi';
import Pagination from '../components/Pagination';


const FILTROS = ['Todos', 'Con Saldo', 'En Mora', 'Pagado', 'Sin Gestión', '🚨 Casos Críticos (>180 días)', '📌 Casos Especiales'];

function getCasoEspecialTag(idLote, listaCasos = []) {
  return obtenerBadgeCasoEspecial(idLote, listaCasos);
}

function PctBar({ valor, total }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round(((total - valor) / total) * 100))) : 100;
  const color = pct > 70 ? '#16a34a' : pct > 40 ? '#3b82f6' : '#f59e0b';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 100, overflow: 'hidden', minWidth: 50 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 100 }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function KpiCard({ color, icon, value, label, sub, subColor }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-value" style={{ fontSize: 15 }}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-change" style={{ color: subColor || 'inherit' }}>{sub}</div>}
    </div>
  );
}

export default function Cartera() {
  const { user } = useAuth();
  const [allCartera, setAllCartera]   = useState([]);
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filtro, setFiltro]           = useState('Todos');

  // Casos especiales y auditoría
  const [casosEspeciales, setCasosEspeciales] = useState([]);
  const [showModalLogs, setShowModalLogs]     = useState(false);

  // Paginación
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(50);

  // Modo de vista: 'general' | 'verificacion' | 'abonos' | 'casos_especiales'
  const [vistaModo, setVistaModo]     = useState('general');
  const [filtroVerif, setFiltroVerif] = useState('Todos'); // 'Todos' | 'Al Día' | 'En Mora' | 'Críticos' | 'Saldados'
  const [pageVerif, setPageVerif]     = useState(1);
  const [pageSizeVerif, setPageSizeVerif] = useState(50);

  // Modales
  const [selected, setSelected]       = useState(null);
  const [cuotasVenta, setCuotasVenta] = useState([]);
  const [loadingCuotas, setLoadingCuotas] = useState(false);
  const [activeTab, setActiveTab]     = useState('resumen'); // 'resumen' | 'matriz' | 'cuotas'

  // Modales de Acción
  const [editingCuota, setEditingCuota] = useState(null);
  const [editingContrato, setEditingContrato] = useState(null);

  // Recibos de Caja Menor
  const [recibosVenta, setRecibosVenta] = useState([]);
  const [showModalPagoRecibo, setShowModalPagoRecibo] = useState(false);
  const [pagoReciboVenta, setPagoReciboVenta] = useState(null);
  const [pagoReciboCuota, setPagoReciboCuota] = useState(null);
  const [reciboParaVer, setReciboParaVer] = useState(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (force) clearCarteraCache();
      const [data, s, casos] = await Promise.all([
        getCartera({ forceRefresh: force }),
        getCarteraStats(force),
        getCasosEspeciales(),
      ]);
      setAllCartera(data || []);
      setStats(s);
      setCasosEspeciales(casos || []);
    } catch (e) {
      console.error('Error cargando cartera:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const casosEspecialesActivosCount = useMemo(() => {
    return (casosEspeciales || []).filter(c => c.estado !== 'RESUELTO').length;
  }, [casosEspeciales]);

  // Filtrado 100% en memoria (0.1ms sin peticiones de red repetitivas)
  const filteredCartera = useMemo(() => {
    let result = allCartera;

    if (filtro && filtro !== 'Todos') {
      if (filtro === 'Con Saldo') {
        result = result.filter(v => v.saldo > 0 && v.estado === 'VENDIDO');
      } else if (filtro === 'Pagado') {
        result = result.filter(v => v.saldo <= 0 && v.estado === 'VENDIDO');
      } else if (filtro === 'En Mora') {
        result = result.filter(v => v.cuotas_vencidas > 0);
      } else if (filtro === 'Sin Gestión') {
        result = result.filter(v => !v.fecha_venta && v.saldo > 0);
      } else if (filtro === '🚨 Casos Críticos (>180 días)' || filtro === 'Casos Críticos') {
        result = result.filter(v => v.es_critico && v.saldo > 0);
      } else if (filtro === '📌 Casos Especiales') {
        result = result.filter(v => Boolean(getCasoEspecialTag(v.id_lote || v.lotes?.id_lote, casosEspeciales)));
      }
    }

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      result = result.filter(v =>
        (v.id_lote && v.id_lote.toLowerCase().includes(s)) ||
        (v.lotes?.id_lote && v.lotes.id_lote.toLowerCase().includes(s)) ||
        (v.cliente_nombre && v.cliente_nombre.toLowerCase().includes(s)) ||
        (v.clientes?.nombre && v.clientes.nombre.toLowerCase().includes(s)) ||
        (v.vendedor_nombre && v.vendedor_nombre.toLowerCase().includes(s)) ||
        (v.clientes?.doc_cliente && String(v.clientes.doc_cliente).toLowerCase().includes(s)) ||
        (v.clientes?.celular && String(v.clientes.celular).includes(s))
      );
    }

    return result;
  }, [allCartera, filtro, search, casosEspeciales]);

  // Paginación para mantener la tabla liviana y reactiva
  const paginatedCartera = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCartera.slice(start, start + pageSize);
  }, [filteredCartera, page, pageSize]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
    setPageVerif(1);
  };

  const handleFiltroChange = (e) => {
    setFiltro(e.target.value);
    setPage(1);
  };

  // ── Módulo de Verificación Lote por Lote (Al Día / En Mora) ──────────────
  const alDiaCount    = useMemo(() => allCartera.filter(v => v.estado === 'VENDIDO' && (v.cuotas_vencidas || 0) === 0 && (v.saldo || 0) > 0).length, [allCartera]);
  const moraCount     = useMemo(() => allCartera.filter(v => v.estado === 'VENDIDO' && (v.cuotas_vencidas || 0) > 0).length, [allCartera]);
  const saldadosCount = useMemo(() => allCartera.filter(v => v.estado === 'VENDIDO' && (v.saldo || 0) <= 0).length, [allCartera]);
  const criticosCount = useMemo(() => allCartera.filter(v => v.estado === 'VENDIDO' && (v.cuotas_vencidas || 0) >= 3).length, [allCartera]);

  const verificacionCartera = useMemo(() => {
    let list = allCartera.filter(v => v.estado === 'VENDIDO');

    if (filtroVerif === 'Al Día') {
      list = list.filter(v => (v.cuotas_vencidas || 0) === 0 && (v.saldo || 0) > 0);
    } else if (filtroVerif === 'En Mora') {
      list = list.filter(v => (v.cuotas_vencidas || 0) > 0);
    } else if (filtroVerif === 'Críticos') {
      list = list.filter(v => (v.cuotas_vencidas || 0) >= 3);
    } else if (filtroVerif === 'Saldados') {
      list = list.filter(v => (v.saldo || 0) <= 0);
    }

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      list = list.filter(v =>
        (v.id_lote && v.id_lote.toLowerCase().includes(s)) ||
        (v.lotes?.id_lote && v.lotes.id_lote.toLowerCase().includes(s)) ||
        (v.cliente_nombre && v.cliente_nombre.toLowerCase().includes(s)) ||
        (v.clientes?.nombre && v.clientes.nombre.toLowerCase().includes(s)) ||
        (v.vendedor_nombre && v.vendedor_nombre.toLowerCase().includes(s)) ||
        (v.clientes?.doc_cliente && String(v.clientes.doc_cliente).toLowerCase().includes(s)) ||
        (v.clientes?.celular && String(v.clientes.celular).includes(s))
      );
    }

    return list;
  }, [allCartera, filtroVerif, search]);

  const paginatedVerif = useMemo(() => {
    const start = (pageVerif - 1) * pageSizeVerif;
    return verificacionCartera.slice(start, start + pageSizeVerif);
  }, [verificacionCartera, pageVerif, pageSizeVerif]);

  const exportarVerificacionExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const rows = verificacionCartera.map((v, idx) => ({
      '#': idx + 1,
      'ID LOTE': v.id_lote || v.lotes?.id_lote || '',
      'CLIENTE': v.cliente_nombre || v.clientes?.nombre || '',
      'DOCUMENTO': v.clientes?.doc_cliente || '',
      'TELÉFONO': v.clientes?.celular || '',
      'DIAGNÓSTICO': (v.saldo || 0) <= 0 ? 'SALDADO / PAZ Y SALVO' : ((v.cuotas_vencidas || 0) > 0 ? `DEBE ${v.cuotas_vencidas} CUOTAS` : 'AL DÍA'),
      'CUOTAS VENCIDAS': v.cuotas_vencidas || 0,
      'VALOR EN MORA ESTIMADO': (v.cuotas_vencidas || 0) * (v.valor_cuota || 0),
      'CUOTAS PAGADAS': v.cuotas_pagadas_count || 0,
      'PLAZO CUOTAS': v.plazo_cuotas || 0,
      'VALOR CUOTA': v.valor_cuota || 0,
      'TOTAL PAGADO': v.total_pagado || 0,
      'SALDO RESTANTE': v.saldo || 0,
      'ASESOR COMERCIAL': v.vendedor_nombre || '',
      'FECHA VENTA': v.fecha_venta ? formatDate(v.fecha_venta) : ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Verificación Lote a Lote');
    XLSX.writeFile(wb, `Verificacion_Lote_por_Lote_LaCeiba_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const openDetalle = async (v) => {
    setSelected(v);
    setActiveTab('resumen');
    setLoadingCuotas(true);
    try {
      const [cuotas, recs] = await Promise.all([
        getCuotasByVenta(v.id),
        obtenerRecibosPorVenta(v.id)
      ]);
      setCuotasVenta(cuotas || []);
      setRecibosVenta(recs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCuotas(false);
    }
  };

  const refreshCuotas = async (ventaId) => {
    if (!ventaId) return;
    try {
      const [cuotas, recs] = await Promise.all([
        getCuotasByVenta(ventaId),
        obtenerRecibosPorVenta(ventaId)
      ]);
      setCuotasVenta(cuotas || []);
      setRecibosVenta(recs || []);
    } catch (e) {
      console.error(e);
    }
  };

  const totalSaldoVisible = filteredCartera.reduce((a, v) => a + (v.saldo || 0), 0);

  return (
    <div>
      {/* Header con botón principal de Abonos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="page-title" style={{ fontSize: 22, fontWeight: 800 }}>Gestión de Cartera y Recaudos</div>
          <div className="page-subtitle">Control financiero en vivo, liquidación automática de cuotas y estados de cuenta</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: 13, gap: 8, padding: '9px 18px', background: '#16a34a', borderColor: '#15803d', fontWeight: 800, boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)' }}
            onClick={() => {
              setPagoReciboVenta(null);
              setPagoReciboCuota(null);
              setShowModalPagoRecibo(true);
            }}
            title="Abonar a contrato o cuota y emitir recibo oficial"
          >
            <DollarSign size={16} /> 💳 Abonar
          </button>
        </div>
      </div>

      {/* Alerta de cuotas vencidas */}
      {stats?.cuotasVencidas > 0 && (
        <div className="alert-banner red" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />
          <span>
            <strong>{stats.cuotasVencidas} cuotas vencidas</strong> en la cartera —
            Saldo total por recaudar: <strong>{formatCOP(stats.totalSaldo)}</strong>
          </span>
        </div>
      )}

      {/* KPIs — Visión global de la cartera */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <KpiCard color="blue"   icon={<DollarSign size={18}/>}
          value={formatCOP(stats?.totalValorVentas)}
          label="Valor Total Ventas"
          sub={`${stats?.totalVentas ?? 0} contratos vendidos`} />
        <KpiCard color="green"  icon={<TrendingUp size={18}/>}
          value={formatCOP(stats?.totalRecaudado)}
          label="Total Recaudado"
          sub={stats && stats.totalValorVentas > 0
            ? `${Math.round((stats.totalRecaudado / stats.totalValorVentas) * 100)}% del total`
            : '—'} />
        <KpiCard color="yellow" icon={<Clock size={18}/>}
          value={formatCOP(stats?.totalSaldo)}
          label="Saldo Pendiente Clientes"
          sub={`${stats?.conSaldo ?? 0} contratos activos`}
          subColor="#d97706" />
        <KpiCard color="red"    icon={<Users size={18}/>}
          value={stats?.cuotasVencidas ?? 0}
          label="Cuotas en Mora"
          sub="Cuotas vencidas por cobrar"
          subColor="#dc2626" />
      </div>

      {/* KPIs de cuotas detalladas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cuotas Al Día / Futuras', val: stats?.cuotasAlDia,     color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
          { label: 'Cuotas Pagadas',          val: stats?.cuotasPagadas,   color: '#0284c7', bg: 'rgba(2,132,199,0.08)' },
          { label: 'Cuotas Vencidas (Mora)',  val: stats?.cuotasVencidas,   color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
          { label: 'Total Cuotas del Proyecto',val: stats?.totalCuotas,     color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}25`,
            borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{(s.val ?? 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Selector de Modo de Vista ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '2px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className={`btn ${vistaModo === 'general' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 13, gap: 8, padding: '8px 16px', fontWeight: 700 }}
            onClick={() => setVistaModo('general')}
          >
            <Table size={16} />
            Matriz de Cartera General
          </button>

          <button
            className={`btn ${vistaModo === 'verificacion' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              fontSize: 13, gap: 8, padding: '8px 16px', fontWeight: 700,
              background: vistaModo === 'verificacion' ? '#0f766e' : undefined,
              borderColor: vistaModo === 'verificacion' ? '#0d9488' : undefined,
              color: vistaModo === 'verificacion' ? '#fff' : undefined
            }}
            onClick={() => setVistaModo('verificacion')}
          >
            <ShieldAlert size={16} />
            🔍 Verificación Lote por Lote (Al Día / En Mora)
          </button>

          <button
            className={`btn ${vistaModo === 'abonos' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              fontSize: 13, gap: 8, padding: '8px 16px', fontWeight: 700,
              background: vistaModo === 'abonos' ? '#b45309' : undefined,
              borderColor: vistaModo === 'abonos' ? '#92400e' : undefined,
              color: vistaModo === 'abonos' ? '#fff' : undefined
            }}
            onClick={() => setVistaModo('abonos')}
          >
            <Zap size={16} />
            ⚡ Abonos Extraordinarios
          </button>

          <button
            className={`btn ${vistaModo === 'casos_especiales' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              fontSize: 13, gap: 8, padding: '8px 16px', fontWeight: 700,
              background: vistaModo === 'casos_especiales' ? '#6d28d9' : undefined,
              borderColor: vistaModo === 'casos_especiales' ? '#5b21b6' : undefined,
              color: vistaModo === 'casos_especiales' ? '#fff' : undefined
            }}
            onClick={() => setVistaModo('casos_especiales')}
          >
            <Tag size={15} />
            📌 Casos Especiales & Observaciones
            {casosEspecialesActivosCount > 0 && (
              <span style={{
                background: vistaModo === 'casos_especiales' ? '#fff' : '#6d28d9',
                color: vistaModo === 'casos_especiales' ? '#6d28d9' : '#fff',
                fontSize: 10.5, fontWeight: 900, padding: '1px 6px', borderRadius: 10, marginLeft: 4
              }}>
                {casosEspecialesActivosCount}
              </span>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

          <button
            className="btn btn-ghost"
            style={{
              fontSize: 12, gap: 6, padding: '8px 14px', fontWeight: 700,
              color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff'
            }}
            onClick={() => setShowModalLogs(true)}
            title="Ver registro auditable de acciones, amortizaciones y cambios"
          >
            <ShieldCheck size={15} /> 📋 Historial de Acciones
          </button>

          {vistaModo === 'verificacion' && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, gap: 6, color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4', fontWeight: 700 }}
              onClick={exportarVerificacionExcel}
              title="Descargar auditoría lote por lote en Excel"
            >
              <Download size={14} /> Exportar Auditoría a Excel
            </button>
          )}
        </div>
      </div>

      {vistaModo === 'general' && (
        <>
          {/* Barra de búsqueda y filtros generales */}
          <div className="search-bar" style={{ marginBottom: 16 }}>

            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="search-input" style={{ paddingLeft: 36 }}
                placeholder="Buscar por lote, cliente, vendedor, cédula..."
                value={search} onChange={handleSearchChange} />
            </div>
            <select className="filter-select" value={filtro} onChange={handleFiltroChange}>
              {FILTROS.map(f => <option key={f}>{f}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={() => load(true)} title="Recargar base de datos">
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Tabla de Cartera General */}
          <div className="table-container">
            <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="table-header-title">
                Cartera de Clientes — {filteredCartera.length} contratos
                {filtro !== 'Todos' && ` (${filtro})`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Saldo cartera visible: <strong style={{ color: '#d97706' }}>{formatCOP(totalSaldoVisible)}</strong>
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Cargando cartera consolidada...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Lote</th>
                        <th>Cliente</th>
                        <th>Vendedor</th>
                        <th>Fecha Venta</th>
                        <th>Precio Venta</th>
                        <th>Cuota Inicial</th>
                        <th>Saldo Financiado</th>
                        <th>Cuotas Pagadas</th>
                        <th>Saldo Pendiente</th>
                        <th>Estado</th>
                        <th style={{ textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCartera.map((v, i) => {
                        const rowIdx = (page - 1) * pageSize + i + 1;
                        const saldoColor = (v.saldo || 0) <= 0 ? '#16a34a'
                          : (v.cuotas_vencidas > 0) ? '#dc2626' : '#d97706';
                        const especial = getCasoEspecialTag(v.id_lote || v.lotes?.id_lote, casosEspeciales);

                        return (
                          <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => openDetalle(v)}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{rowIdx}</td>
                            <td>
                              <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
                                {v.id_lote || v.lotes?.id_lote || '—'}
                              </div>
                              {especial && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVistaModo('casos_especiales');
                                  }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    fontSize: 9.5, fontWeight: 700,
                                    padding: '2px 7px', borderRadius: 4,
                                    background: especial.bg, color: especial.color, marginTop: 3,
                                    cursor: 'pointer', border: `1px solid ${especial.color}40`
                                  }}
                                  title="Caso Especial Activo. Clic para gestionar en pestaña Casos Especiales."
                                >
                                  <span>{especial.icon || '📌'}</span>
                                  {especial.text}
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{v.cliente_nombre || v.clientes?.nombre || '—'}</div>
                              {v.clientes?.doc_cliente && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>CC {v.clientes.doc_cliente}</div>
                              )}
                            </td>
                            <td style={{ fontSize: 12 }}>{v.vendedor_nombre ?? '—'}</td>
                            <td style={{ fontSize: 12 }}>{v.fecha_venta ? formatDate(v.fecha_venta) : <span style={{color:'#dc2626',fontSize:11}}>Sin fecha</span>}</td>
                            <td style={{ fontSize: 12 }}>{formatCOP(v.precio_venta)}</td>
                            <td style={{ fontSize: 12 }}>{formatCOP(v.valor_cuota_inicial)}</td>
                            <td style={{ fontSize: 12 }}>{formatCOP(v.saldo_financiado)}</td>
                            <td style={{ fontSize: 12, color: '#0284c7', fontWeight: 600 }}>
                              {formatCOP(v.cuotas_pagadas_monto)}
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                                {v.cuotas_pagadas_count || 0} / {v.total_cuotas || v.plazo_cuotas || '—'} cuotas
                              </div>
                            </td>
                            <td style={{ fontWeight: 700, color: saldoColor, fontSize: 13 }}>
                              {formatCOP(v.saldo)}
                              <PctBar valor={v.saldo || 0} total={v.saldo_financiado || v.precio_venta || 1} />
                            </td>
                            <td>
                              {v.saldo <= 0 ? (
                                <span className="badge" style={{ background: '#f0fdf4', color: '#16a34a' }}>PAZ Y SALVO</span>
                              ) : v.cuotas_vencidas > 0 ? (
                                <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
                                  {v.cuotas_vencidas} EN MORA
                                </span>
                              ) : (
                                <span className="badge" style={{ background: '#f0fdf4', color: '#16a34a' }}>AL DÍA</span>
                              )}
                            </td>
                            <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                <button
                                  className="btn btn-ghost"
                                  style={{ fontSize: 11, padding: '4px 8px', color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4', fontWeight: 700 }}
                                  title="Abonar a este contrato y emitir recibo oficial"
                                  onClick={() => {
                                    setPagoReciboVenta(v);
                                    setPagoReciboCuota(null);
                                    setShowModalPagoRecibo(true);
                                  }}
                                >
                                  💳 Abonar
                                </button>
                                <button
                                  className="btn btn-ghost"
                                  style={{ fontSize: 11, padding: '4px 8px' }}
                                  onClick={() => openDetalle(v)}
                                >
                                  <FileText size={12} /> Ver
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredCartera.length === 0 && (
                        <tr>
                          <td colSpan="12" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                            No se encontraron contratos con los criterios especificados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={page}
                  totalItems={filteredCartera.length}
                  pageSize={pageSize}
                  pageSizeOptions={[25, 50, 100]}
                  onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
                  onPageChange={(p) => setPage(p)}
                />
              </>
            )}
          </div>
        </>
      )}

      {vistaModo === 'verificacion' && (
        /* ── MODO VERIFICACIÓN LOTE POR LOTE ── */
        <div className="table-container">
          {/* Tarjetas de Diagnóstico de Verificación */}
          <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CONTRATOS AUDITADOS</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#334155', marginTop: 2 }}>{allCartera.filter(v => v.estado === 'VENDIDO').length}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Lotes con contrato activo</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>🟢 CLIENTES AL DÍA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginTop: 2 }}>{alDiaCount}</div>
                <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>Al corriente (0 cuotas vencidas)</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>🔴 CLIENTES EN MORA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#b91c1c', marginTop: 2 }}>{moraCount}</div>
                <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>Deben 1 o más cuotas</div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>⚪ SALDADOS / PAZ Y SALVO</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8', marginTop: 2 }}>{saldadosCount}</div>
                <div style={{ fontSize: 10, color: '#2563eb', marginTop: 2 }}>100% pagados</div>
              </div>
            </div>

            {/* Píldoras de Filtro y Buscador */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: 'Todos', label: `Todos (${allCartera.filter(v => v.estado === 'VENDIDO').length})` },
                  { id: 'Al Día', label: `🟢 Al Día (${alDiaCount})` },
                  { id: 'En Mora', label: `🔴 Debe Cuotas (${moraCount})` },
                  { id: 'Críticos', label: `🚨 Mora Crítica >=3 (${criticosCount})` },
                  { id: 'Saldados', label: `⚪ Saldados (${saldadosCount})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    className={`btn ${filtroVerif === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                    style={{
                      fontSize: 12, padding: '5px 12px', borderRadius: 20, fontWeight: 600,
                      background: filtroVerif === tab.id ? (tab.id === 'En Mora' || tab.id === 'Críticos' ? '#dc2626' : (tab.id === 'Al Día' ? '#16a34a' : '#0f766e')) : '#fff',
                      borderColor: filtroVerif === tab.id ? 'transparent' : '#cbd5e1',
                      color: filtroVerif === tab.id ? '#fff' : '#475569'
                    }}
                    onClick={() => { setFiltroVerif(tab.id); setPageVerif(1); }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: 280 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="search-input"
                  style={{ paddingLeft: 34, fontSize: 12, height: 34, background: '#fff' }}
                  placeholder="Buscar lote, cliente, cédula..."
                  value={search}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
          </div>

          {/* Tabla de Verificación Directa Lote por Lote */}
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Lote</th>
                  <th>Cliente</th>
                  <th>Diagnóstico de Cartera</th>
                  <th>Progreso Cuotas</th>
                  <th>Saldo Restante</th>
                  <th>Asesor</th>
                  <th style={{ textAlign: 'center' }}>Auditar</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVerif.map((v, i) => {
                  const rowIdx = (pageVerif - 1) * pageSizeVerif + i + 1;
                  const especial = getCasoEspecialTag(v.id_lote || v.lotes?.id_lote, casosEspeciales);
                  const isSaldado = (v.saldo || 0) <= 0;
                  const isMora = (v.cuotas_vencidas || 0) > 0;
                  const montoMoraEstimado = (v.cuotas_vencidas || 0) * (v.valor_cuota || 0);

                  return (
                    <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => openDetalle(v)}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{rowIdx}</td>
                      <td>
                        <div style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 13, color: '#1e293b' }}>
                          {v.id_lote || v.lotes?.id_lote || '—'}
                        </div>
                        {especial && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setVistaModo('casos_especiales');
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 9.5, fontWeight: 700,
                              padding: '2px 7px', borderRadius: 4,
                              background: especial.bg, color: especial.color, marginTop: 3,
                              cursor: 'pointer', border: `1px solid ${especial.color}40`
                            }}
                            title="Caso Especial Activo. Clic para gestionar en pestaña Casos Especiales."
                          >
                            <span>{especial.icon || '📌'}</span>
                            {especial.text}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{v.cliente_nombre || v.clientes?.nombre || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                          {v.clientes?.doc_cliente && <span>CC {v.clientes.doc_cliente}</span>}
                          {v.clientes?.celular && <span>· Tel: {v.clientes.celular}</span>}
                        </div>
                      </td>
                      <td>
                        {isSaldado ? (
                          <div>
                            <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: 12, fontWeight: 700 }}>
                              <CheckCircle2 size={11} style={{ marginRight: 4 }} /> PAZ Y SALVO
                            </span>
                            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>100% cancelado</div>
                          </div>
                        ) : isMora ? (
                          <div>
                            <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: 12, fontWeight: 700 }}>
                              <AlertTriangle size={11} style={{ marginRight: 4 }} /> DEBE {v.cuotas_vencidas} CUOTA{v.cuotas_vencidas > 1 ? 'S' : ''}
                            </span>
                            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2, fontWeight: 700 }}>
                              Mora aprox: {formatCOP(montoMoraEstimado)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: 12, fontWeight: 700 }}>
                              <CheckCircle2 size={11} style={{ marginRight: 4 }} /> AL DÍA
                            </span>
                            <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>Al corriente (0 vencidas)</div>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          {v.cuotas_pagadas_count || 0} de {v.total_cuotas || v.plazo_cuotas || '—'} cuotas
                        </div>
                        <div style={{ marginTop: 4, width: 110 }}>
                          <PctBar valor={v.saldo || 0} total={v.saldo_financiado || v.precio_venta || 1} />
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isSaldado ? '#16a34a' : (isMora ? '#dc2626' : '#0284c7') }}>
                          {formatCOP(v.saldo)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          Financiado: {formatCOP(v.saldo_financiado)}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {v.vendedor_nombre || '—'}
                      </td>
                      <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '4px 8px', gap: 4, background: '#16a34a', borderColor: '#15803d', fontWeight: 700 }}
                            onClick={() => {
                              setPagoReciboVenta(v);
                              setPagoReciboCuota(null);
                              setShowModalPagoRecibo(true);
                            }}
                            title="Abonar a este contrato y emitir recibo oficial"
                          >
                            💳 Abonar
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '4px 8px', gap: 4, color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }}
                            onClick={() => openDetalle(v)}
                            title="Ver estado de cuenta completo del lote"
                          >
                            <FileText size={12} /> Extracto
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
                {verificacionCartera.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      No se encontraron lotes con el filtro de verificación seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={pageVerif}
            totalItems={verificacionCartera.length}
            pageSize={pageSizeVerif}
            pageSizeOptions={[25, 50, 100]}
            onPageSizeChange={(sz) => { setPageSizeVerif(sz); setPageVerif(1); }}
            onPageChange={(p) => setPageVerif(p)}
          />
        </div>
      )}

      {vistaModo === 'abonos' && (
        <div className="table-container" style={{ padding: '20px' }}>
          <AbonosExtraordinariosView
            onVerExtracto={async (ventaId) => {
              const venta = allCartera.find(v => v.id === ventaId || v.venta_id === ventaId);
              if (venta) openDetalle(venta);
            }}
          />
        </div>
      )}

      {vistaModo === 'casos_especiales' && (
        <div className="table-container" style={{ padding: '20px' }}>
          <CasosEspecialesView
            onOpenEstadoCuenta={(idLote) => {
              const norm = (str) => (str || '').toUpperCase().replace(/\s+/g, '').replace(/[-_]/g, '');
              const target = norm(idLote);
              const venta = allCartera.find(v => {
                const lStr = norm(v.id_lote || v.lotes?.id_lote);
                return lStr.includes(target) || target.includes(lStr);
              });
              if (venta) openDetalle(venta);
            }}
            usuarioActual={user}
          />
        </div>
      )}


      {/* ── Modal Detalle de Contrato ── */}
      {selected && (
        <Modal onClose={() => { setSelected(null); setCuotasVenta([]); }} maxWidth={activeTab === 'matriz' ? 980 : 760}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {selected.id_lote || selected.lotes?.id_lote} — {selected.cliente_nombre || selected.clientes?.nombre}
                {getCasoEspecialTag(selected.id_lote || selected.lotes?.id_lote, casosEspeciales) && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: getCasoEspecialTag(selected.id_lote || selected.lotes?.id_lote, casosEspeciales).bg,
                    color: getCasoEspecialTag(selected.id_lote || selected.lotes?.id_lote, casosEspeciales).color }}>
                    {getCasoEspecialTag(selected.id_lote || selected.lotes?.id_lote, casosEspeciales).text}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {selected.fecha_venta ? `Venta: ${formatDate(selected.fecha_venta)}` : '⚠ Sin fecha de venta'}
                {cuotasVenta.length > 0 && ` · ${cuotasVenta.length} cuotas registradas`}
                {selected.clientes?.doc_cliente && ` · Cédula: ${selected.clientes.doc_cliente}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '6px 14px', background: '#16a34a', borderColor: '#16a34a', gap: 6, fontWeight: 700 }}
                onClick={() => {
                  setPagoReciboVenta(selected);
                  setPagoReciboCuota(null);
                  setShowModalPagoRecibo(true);
                }}
                title="Abonar a este contrato y emitir recibo oficial"
              >
                💳 Abonar
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '6px 10px', gap: 6 }}
                onClick={() => setEditingContrato(selected)}
              >
                <Edit2 size={13} /> Editar Contrato
              </button>
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }}
                onClick={() => { setSelected(null); setCuotasVenta([]); setRecibosVenta([]); }}>✕</button>
            </div>
          </div>

          {/* Selector de pestañas */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
            {[
              { id: 'resumen', label: 'Resumen Financiero', icon: <FileText size={14} /> },
              { id: 'matriz',  label: 'Estado de Cuenta (Matriz)', icon: <Table size={14} /> },
              { id: 'cuotas',  label: `Tabla de Cuotas (${cuotasVenta.length})`, icon: <Calendar size={14} /> },
              { id: 'recibos', label: `🧾 Recibos de Caja (${recibosVenta.length})`, icon: <Receipt size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', border: 'none', background: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #16a34a' : '2px solid transparent',
                  color: activeTab === tab.id ? '#16a34a' : 'var(--text-muted)',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: 13, cursor: 'pointer', marginBottom: -1
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: RESUMEN */}
          {activeTab === 'resumen' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Precio Total', val: formatCOP(selected.precio_venta), color: '#374151' },
                  { label: 'Cuota Inicial', val: formatCOP(selected.valor_cuota_inicial), color: '#374151' },
                  { label: 'Saldo Financiado', val: formatCOP(selected.saldo_financiado), color: '#374151' },
                  { label: 'Cuotas Pagadas', val: formatCOP(selected.cuotas_pagadas_monto), color: '#0284c7' },
                  { label: 'Total Recaudado', val: formatCOP(selected.total_pagado), color: '#16a34a' },
                  { label: 'Saldo Pendiente', val: formatCOP(selected.saldo),
                    color: selected.saldo <= 0 ? '#16a34a' : (selected.cuotas_vencidas > 0 ? '#dc2626' : '#d97706') },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.color, marginTop: 2 }}>{item.val}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span>Progreso de Pago Total</span>
                  <strong>{Math.min(100, Math.round(((selected.total_pagado || 0) / (selected.precio_venta || 1)) * 100))}%</strong>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round(((selected.total_pagado || 0) / (selected.precio_venta || 1)) * 100))}%`,
                    background: '#16a34a', borderRadius: 100
                  }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div><strong>Vendedor:</strong> {selected.vendedor_nombre || '—'}</div>
                <div><strong>Día de Pago:</strong> {selected.dias_pago || '—'}</div>
                <div><strong>Medio de Pago:</strong> {selected.medio_pago || '—'}</div>
                <div><strong>Plazo:</strong> {selected.plazo_cuotas ? `${selected.plazo_cuotas} meses` : '—'}</div>
                <div><strong>Valor Cuota:</strong> {formatCOP(selected.valor_cuota)}</div>
                <div><strong>Área del Lote:</strong> {selected.lotes?.area_m2 ? `${selected.lotes.area_m2} m²` : '—'}</div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1, fontSize: 12, gap: 6 }}
                  onClick={() => exportEstadoCuentaMatrizPDF(selected, cuotasVenta)}
                >
                  <Download size={14} /> Descargar Estado de Cuenta (PDF)
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1, fontSize: 12, gap: 6 }}
                  onClick={() => exportEstadoCuentaInformePDF(selected, cuotasVenta)}
                >
                  <FileText size={14} /> Descargar Informe Gerencial
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MATRIZ DE CUOTAS */}
          {activeTab === 'matriz' && (
            <EstadoCuentaMatrizView
              venta={selected}
              cuotas={cuotasVenta}
              loading={loadingCuotas}
              onEditarCuota={(cuota) => setEditingCuota(cuota)}
            />
          )}

          {/* TAB 3: LISTADO DE CUOTAS */}
          {activeTab === 'cuotas' && (
            <div>
              {loadingCuotas ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando cuotas...</div>
              ) : (
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-base)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Vencimiento</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Valor Cuota</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Valor Pagado</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Fecha Pago</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Estado</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuotasVenta.map((c) => {
                        const cuotaRecs = recibosVenta.filter(r => r.cuota_id === c.id);
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                              <div>Cuota {c.numero_cuota}</div>
                              {/* Badges de recibos emitidos en esta cuota */}
                              {cuotaRecs.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                                  {cuotaRecs.map(r => (
                                    <button
                                      key={r.numero_recibo}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setReciboParaVer({ ...r, autoDownload: true }); }}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                                        padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                      title="Clic para ver y descargar este Recibo Oficial en PDF"
                                    >
                                      <Receipt size={11} /> Recibo #{r.numero_recibo} ({formatCOP(r.valor)}) <Download size={11} color="#2563eb" style={{ marginLeft: 2 }} />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '6px 10px' }}>{formatDate(c.fecha_vencimiento)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>{formatCOP(c.valor_cuota)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                              {formatCOP(c.valor_pagado)}
                            </td>
                            <td style={{ padding: '6px 10px' }}>{c.fecha_pago ? formatDate(c.fecha_pago) : '—'}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                background: c.estado_cuota === 'PAGA' ? '#f0f9ff' : c.estado_cuota === 'VENCIDA' ? '#fef2f2' : '#f0fdf4',
                                color: c.estado_cuota === 'PAGA' ? '#0284c7' : c.estado_cuota === 'VENCIDA' ? '#dc2626' : '#16a34a'
                              }}>
                                {c.estado_cuota}
                              </span>
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button
                                  className="btn btn-ghost"
                                  style={{
                                    padding: '3px 8px', fontSize: 11,
                                    color: '#15803d', borderColor: '#86efac', background: '#f0fdf4',
                                    fontWeight: 700, gap: 4
                                  }}
                                  onClick={() => {
                                    setPagoReciboVenta(selected);
                                    setPagoReciboCuota(c);
                                    setShowModalPagoRecibo(true);
                                  }}
                                  title="Abonar a esta cuota y emitir recibo oficial"
                                >
                                  <Receipt size={11} /> Abonar
                                </button>

                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  onClick={() => setEditingCuota(c)}
                                  title="Ajuste manual de cuota"
                                >
                                  <Edit2 size={11} /> Editar
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
          )}

          {/* TAB 4: HISTORIAL DE RECIBOS DE CAJA MENOR */}
          {activeTab === 'recibos' && (
            <div>
              {recibosVenta.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                  <Receipt size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                    No hay recibos de caja emitidos para este contrato aún.
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 16 }}>
                    Cada pago registrado generará su recibo numerado con valor en letras listo para imprimir.
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ background: '#16a34a', borderColor: '#16a34a', fontSize: 12.5, padding: '8px 16px', gap: 6, fontWeight: 700 }}
                    onClick={() => {
                      setPagoReciboVenta(selected);
                      setPagoReciboCuota(null);
                      setShowModalPagoRecibo(true);
                    }}
                    title="Abonar a este contrato y emitir recibo oficial"
                  >
                    💳 Abonar
                  </button>
                </div>
              ) : (
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-base)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Nº Recibo</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Fecha Pago</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Cuota / Concepto</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Valor Pagado</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Medio de Pago</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recibosVenta
                        .filter(r => r && (r.numero_recibo || r.valor))
                        .map((r, rIdx) => {
                          const numRec = r.numero_recibo ? String(r.numero_recibo).padStart(4, '0') : '—';
                          const concStr = typeof r.concepto === 'string' ? r.concepto : (r.numero_cuota ? `Cuota #${r.numero_cuota}` : 'Abono / Pago');
                          const medStr = typeof r.medio_pago === 'string' ? r.medio_pago : 'Transferencia';
                          return (
                            <tr key={r.numero_recibo || r.id || rIdx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  fontFamily: 'monospace', fontWeight: 800, fontSize: 12,
                                  color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
                                  padding: '2px 8px', borderRadius: 4
                                }}>
                                  Nº {numRec}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{formatDate(r.fecha_pago)}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                  {r.numero_cuota ? `Cuota #${r.numero_cuota}` : 'Abono / Pago'}
                                  {r.es_pago_completo ? (
                                    <span style={{ marginLeft: 6, fontSize: 10, color: '#15803d', fontWeight: 700 }}>✓ Total</span>
                                  ) : (
                                    <span style={{ marginLeft: 6, fontSize: 10, color: '#d97706', fontWeight: 700 }}>⚠ Parcial</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{concStr}</div>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#15803d', fontSize: 13 }}>
                                {formatCOP(r.valor)}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <span style={{ fontSize: 10.5, background: '#f1f5f9', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                                  {medStr}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                  <button
                                    className="btn btn-ghost"
                                    style={{
                                      padding: '3px 8px', fontSize: 11,
                                      color: '#15803d', borderColor: '#86efac', background: '#f0fdf4',
                                      fontWeight: 700, gap: 4
                                    }}
                                    onClick={() => setReciboParaVer(r)}
                                    title="Ver / Imprimir este recibo oficial"
                                  >
                                    <Eye size={12} /> Ver
                                  </button>

                                  <button
                                    className="btn btn-primary"
                                    style={{
                                      padding: '3px 8px', fontSize: 11,
                                      background: '#16a34a', borderColor: '#16a34a',
                                      fontWeight: 700, gap: 4
                                    }}
                                    onClick={() => setReciboParaVer({ ...r, autoDownload: true })}
                                    title="Descargar este recibo oficial en PDF"
                                  >
                                    <Download size={12} /> Descargar PDF
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
          )}
        </Modal>
      )}




      {/* Modal Editar Cuota Individual */}
      {editingCuota && (
        <ModalEditarCuota
          cuota={editingCuota}
          onClose={() => setEditingCuota(null)}
          onSuccess={() => {
            load(true);
            if (selected) refreshCuotas(selected.id);
          }}
        />
      )}

      {/* Modal Editar Contrato Completo */}
      {editingContrato && (
        <ModalEditarContrato
          venta={editingContrato}
          onClose={() => setEditingContrato(null)}
          onSuccess={() => {
            load(true);
            setSelected(null);
          }}
        />
      )}

      {/* Modal Historial de Acciones y Auditoría */}
      {showModalLogs && (
        <ModalHistorialAcciones
          onClose={() => setShowModalLogs(false)}
        />
      )}

      {/* Modal Registrar Pago y Emitir Recibo Oficial */}
      {showModalPagoRecibo && (
        <ModalRegistrarPagoRecibo
          venta={pagoReciboVenta}
          cuotaPreseleccionada={pagoReciboCuota}
          allVentas={allCartera}
          onClose={() => {
            setShowModalPagoRecibo(false);
            setPagoReciboVenta(null);
            setPagoReciboCuota(null);
          }}
          onSuccess={() => {
            load(true);
            if (selected) refreshCuotas(selected.id);
          }}
        />
      )}

      {/* Modal Ver / Imprimir Recibo Individual */}
      {reciboParaVer && (
        <ReciboCajaView
          recibo={reciboParaVer}
          onClose={() => setReciboParaVer(null)}
        />
      )}
    </div>
  );
}
