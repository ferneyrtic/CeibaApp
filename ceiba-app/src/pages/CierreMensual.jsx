import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign, Calendar, TrendingUp, CheckCircle2,
  Download, Search, RefreshCw, FileSpreadsheet, FileText,
  Users, CreditCard, RotateCw, Filter, ArrowUpRight, BarChart3,
  Receipt, Wallet, Layers, ArrowUpDown
} from 'lucide-react';
import { getCierreMensualData, clearCierreCache } from '../lib/api/cierreApi';
import { formatCOP, formatDate } from '../utils/helpers';
import Pagination from '../components/Pagination';

// =============================================
// EXPORTADORES A EXCEL Y PDF
// =============================================
const exportExcel = async (sheets, filename) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const cols = Object.keys(data[0] || {}).map(k => ({
      wch: Math.max(k.length, ...data.map(r => String(r[k] ?? '').length).slice(0, 50)) + 2
    }));
    ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
};

const getLogoBase64 = async () => {
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
};

const exportPDFCierre = async (periodo, kpis, items, rankingAsesores, filename) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();

  // Banner Superior
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, 297, 24, 'F');

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'JPEG', 10, 3, 13, 18);
    } catch (e) {
      console.warn('Error embedding logo:', e);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('LA CEIBA GROUP — INFORME DE CIERRE DE RECAUDOS MENSUALES', 28, 10);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodo.desde} al ${periodo.hasta}`, 28, 16);

  // Subtítulo con fecha de generación
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8.5);
  doc.text(
    `Total Recaudado: ${formatCOP(kpis.totalRecaudadoMes)} · ${kpis.totalTransacciones} Transacciones de pago · Cuotas: ${formatCOP(kpis.totalCuotasMes)} (${kpis.countCuotasMes}) · Iniciales: ${formatCOP(kpis.totalInicialesMes)} (${kpis.countInicialesMes})`,
    14, 29
  );
  doc.text(
    `Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
    220, 29
  );

  // Tabla de Ingresos por Fecha de Pago
  const tableRows = items.map(item => [
    formatDate(item.fecha_pago),
    item.lote,
    item.cliente,
    item.doc_cliente,
    item.concepto,
    formatDate(item.fecha_vencimiento),
    formatCOP(item.valor),
    item.medio_pago || '—',
    item.vendedor || 'Sin Asesor'
  ]);

  autoTable(doc, {
    startY: 33,
    head: [[
      'Fecha Pago', 'ID Lote', 'Cliente', 'Cédula', 'Concepto',
      'Fecha Venc.', 'Valor Pagado', 'Medio Pago', 'Asesor Comercial'
    ]],
    body: tableRows,
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [22, 163, 74],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 44 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 26, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 28 },
      8: { cellWidth: 32 },
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount} — Flujo de Caja por Fecha de Pago · La Ceiba Group`, 14, doc.internal.pageSize.height - 6);
    doc.text(`Período: ${periodo.desde} al ${periodo.hasta}`, 230, doc.internal.pageSize.height - 6);
  }

  doc.save(filename);
};

export default function CierreMensual() {
  const today = new Date();
  const defaultDesde = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
  const defaultHasta = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().slice(0,10);
  const [fechaDesde, setFechaDesde] = useState(defaultDesde);
  const [fechaHasta, setFechaHasta] = useState(defaultHasta);

  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [data, setData]                   = useState(null);
  const [exporting, setExporting]         = useState(false);

  // Pestañas: 'todos' | 'cuotas' | 'iniciales' | 'asesores' | 'medios' | 'diario' | 'saldados'
  const [activeTab, setActiveTab]         = useState('todos');
  const [searchTerm, setSearchTerm]       = useState('');
  const [medioFilter, setMedioFilter]     = useState('TODOS');
  const [asesorFilter, setAsesorFilter]   = useState('TODOS');

  // Paginación
  const [page, setPage]                   = useState(1);
  const [pageSize, setPageSize]           = useState(50);

  const periodoLabel = `${fechaDesde} al ${fechaHasta}`;

  const loadData = useCallback(async (force = false) => {
    setLoading(true); setError(null);
    try {
      const res = await getCierreMensualData(fechaDesde, fechaHasta, force);
      setData(res); setPage(1);
    } catch(e) { console.error(e); setError(e.message || 'Error cargando recaudos del periodo'); }
    finally { setLoading(false); }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lista base según la pestaña activa
  const listForTab = useMemo(() => {
    if (!data) return [];
    if (activeTab === 'cuotas') return data.cuotasMes || [];
    if (activeTab === 'iniciales') return data.inicialesMes || [];
    return data.todosIngresos || [];
  }, [data, activeTab]);

  // Filtrar según búsqueda y selectores
  const filteredItems = useMemo(() => {
    return listForTab.filter(item => {
      if (medioFilter !== 'TODOS' && item.medio_pago?.toUpperCase() !== medioFilter.toUpperCase()) {
        return false;
      }
      if (asesorFilter !== 'TODOS' && item.vendedor !== asesorFilter) {
        return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const m1 = item.lote?.toLowerCase().includes(s);
        const m2 = item.cliente?.toLowerCase().includes(s);
        const m3 = item.doc_cliente?.toLowerCase().includes(s);
        const m4 = item.concepto?.toLowerCase().includes(s);
        const m5 = item.vendedor?.toLowerCase().includes(s);
        return m1 || m2 || m3 || m4 || m5;
      }
      return true;
    });
  }, [listForTab, searchTerm, medioFilter, asesorFilter]);

  // Paginación
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // Suma total de los items filtrados
  const totalFiltrado = useMemo(() => {
    return filteredItems.reduce((acc, it) => acc + (it.valor || 0), 0);
  }, [filteredItems]);

  // Lista de asesores y medios para filtros rápidos
  const asesoresDisponibles = useMemo(() => {
    if (!data?.todosIngresos) return [];
    return [...new Set(data.todosIngresos.map(i => i.vendedor).filter(Boolean))].sort();
  }, [data]);

  const mediosDisponibles = useMemo(() => {
    if (!data?.todosIngresos) return [];
    return [...new Set(data.todosIngresos.map(i => (i.medio_pago || 'Transferencia').toUpperCase()))].sort();
  }, [data]);

  // Acciones de exportación
  const handleExportExcel = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const periodoLabel = `${fechaDesde}_${fechaHasta}`;

      const rowsTodos = (data.todosIngresos || []).map(i => ({
        'Fecha de Pago': formatDate(i.fecha_pago),
        'Tipo Ingreso': i.tipoLabel,
        'ID Lote': i.lote,
        'Nombre Cliente': i.cliente,
        'Cédula': i.doc_cliente,
        'Celular': i.celular,
        'Concepto': i.concepto,
        'Fecha Vencimiento': formatDate(i.fecha_vencimiento),
        'Valor Pagado': i.valor,
        'Medio de Pago': i.medio_pago,
        'Asesor Comercial': i.vendedor,
        'Observación': i.observacion,
      }));

      const rowsAsesores = (data.rankingAsesores || []).map(a => ({
        'Asesor Comercial': a.vendedor,
        'Total Recaudado': a.totalRecaudado,
        '% Participación': `${a.pctDelTotal.toFixed(1)}%`,
        '# Transacciones': a.totalTransacciones,
        'Recaudo Cuotas': a.totalCuotas,
        '# Cuotas': a.countCuotas,
        'Recaudo Iniciales': a.totalIniciales,
        '# Iniciales': a.countIniciales,
        'Lotes Atendidos': a.lotesCount,
      }));

      const rowsMedios = (data.desgloseMedios || []).map(m => ({
        'Medio de Pago': m.medio,
        'Total Recaudado': m.total,
        '% Participación': `${m.pct.toFixed(1)}%`,
        '# Transacciones': m.count,
      }));

      await exportExcel([
        { name: 'Todos los Ingresos', data: rowsTodos },
        { name: 'Recaudo por Asesor', data: rowsAsesores },
        { name: 'Medios de Pago', data: rowsMedios },
      ], `Recaudos_Cierre_${periodoLabel}.xlsx`);
    } catch (e) {
      alert('Error exportando a Excel: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const periodo = {
        ...data.periodo,
      };
      await exportPDFCierre(
        periodo,
        data.kpis,
        data.todosIngresos || [],
        data.rankingAsesores || [],
        `Informe_Cierre_Recaudos_${fechaDesde}_${fechaHasta}.pdf`
      );
    } catch (e) {
      alert('Error exportando a PDF: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HEADER DE LA PÁGINA */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DollarSign size={24} color="#16a34a" />
            Cierre Mensual de Caja y Recaudos
          </div>
          <div className="page-subtitle">
            Libro de caja real: registro contable de todo dinero efectivamente entrado por <strong>Fecha de Pago</strong>
          </div>
        </div>

        {/* SELECTORES DE RANGO DE FECHAS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#fff', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px' }}>
            <Calendar size={15} color="var(--text-muted)" />
            <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>Desde</span>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
              style={{ border:'none', background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer', outline:'none', color:'#1e293b' }} />
            <span style={{ fontSize:12, color:'var(--text-muted)', margin:'0 4px' }}>—</span>
            <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>Hasta</span>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
              style={{ border:'none', background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer', outline:'none', color:'#1e293b' }} />
          </div>

          <button
            className="btn btn-ghost"
            onClick={() => loadData(true)}
            disabled={loading}
            title="Recargar datos desde la base de datos"
            style={{ border: '1px solid var(--border)', gap: 6, fontSize: 12, padding: '8px 12px' }}
          >
            <RotateCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualizar
          </button>

          <button
            className="btn btn-ghost"
            onClick={handleExportExcel}
            disabled={loading || exporting || !data}
            style={{ border: '1px solid #16a34a', color: '#16a34a', gap: 6, fontSize: 12, padding: '8px 14px' }}
          >
            <FileSpreadsheet size={14} />
            Exportar Excel (.xlsx)
          </button>

          <button
            className="btn btn-primary"
            onClick={handleExportPDF}
            disabled={loading || exporting || !data}
            style={{ gap: 6, fontSize: 12, padding: '8px 14px', background: '#16a34a', borderColor: '#16a34a' }}
          >
            <Download size={14} />
            Exportar Acta PDF
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="alert-banner red">
          Error cargando cierre del periodo: {error}
        </div>
      )}

      {/* KPIS FINANCIEROS PRINCIPALES */}
      {data && (
        <div className="kpi-grid" style={{ marginBottom: 0 }}>
          {/* KPI 1: TOTAL RECAUDO ENTRADO */}
          <div className="kpi-card green" style={{ borderLeft: '4px solid #16a34a' }}>
            <div className="kpi-icon green">
              <DollarSign size={20} />
            </div>
            <div className="kpi-value" style={{ fontSize: 24, color: '#15803d' }}>
              {formatCOP(data.kpis.totalRecaudadoMes)}
            </div>
            <div className="kpi-label" style={{ fontWeight: 700, color: '#166534' }}>
              Total Dinero Recaudado en el Período
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Ingresos reales ({periodoLabel})
            </div>
          </div>

          {/* KPI 2: CUOTAS MENSUALES */}
          <div className="kpi-card blue">
            <div className="kpi-icon blue">
              <Receipt size={18} />
            </div>
            <div className="kpi-value" style={{ fontSize: 22 }}>
              {formatCOP(data.kpis.totalCuotasMes)}
            </div>
            <div className="kpi-label">
              Recaudo Cuotas Mensuales
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <strong>{data.kpis.countCuotasMes}</strong> cuotas pagadas en el mes
            </div>
          </div>

          {/* KPI 3: CUOTAS INICIALES */}
          <div className="kpi-card purple">
            <div className="kpi-icon purple">
              <TrendingUp size={18} />
            </div>
            <div className="kpi-value" style={{ fontSize: 22, color: '#7c3aed' }}>
              {formatCOP(data.kpis.totalInicialesMes)}
            </div>
            <div className="kpi-label">
              Recaudo Cuotas Iniciales
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <strong>{data.kpis.countInicialesMes}</strong> iniciales de nuevos contratos
            </div>
          </div>

          {/* KPI 4: TRANSACCIONES Y TICKET PROMEDIO */}
          <div className="kpi-card yellow">
            <div className="kpi-icon yellow">
              <CheckCircle2 size={18} />
            </div>
            <div className="kpi-value" style={{ fontSize: 22 }}>
              {data.kpis.totalTransacciones} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>pagos</span>
            </div>
            <div className="kpi-label">
              Transacciones Recibidas
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Ticket promedio: <strong>{formatCOP(data.kpis.ticketPromedio)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑAS Y CONTENIDO PRINCIPAL */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* BARRA DE PESTAÑAS */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: '#f8fafc',
          padding: '0 16px',
          gap: 6,
          overflowX: 'auto'
        }}>
          {[
            { id: 'todos',     label: '📋 Todos los Ingresos',  badge: data?.kpis.totalTransacciones },
            { id: 'cuotas',    label: '📑 Cuotas Mensuales',    badge: data?.kpis.countCuotasMes },
            { id: 'iniciales', label: '🚀 Cuotas Iniciales',    badge: data?.kpis.countInicialesMes },
            { id: 'asesores',  label: '🏆 Recaudo por Asesor',  badge: data?.rankingAsesores?.length },
            { id: 'medios',    label: '💳 Medios de Pago',      badge: data?.desgloseMedios?.length },
            { id: 'diario',    label: '📅 Evolución Diaria',    badge: null },
            { id: 'saldados',  label: '✅ Lotes Saldados',      badge: data?.lotesCompletamentePagados?.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              style={{
                padding: '12px 14px',
                border: 'none',
                background: 'transparent',
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? '#16a34a' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid #16a34a' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
              {tab.badge !== null && tab.badge !== undefined && (
                <span style={{
                  fontSize: 11,
                  background: activeTab === tab.id ? '#dcfce7' : '#e2e8f0',
                  color: activeTab === tab.id ? '#16a34a' : '#64748b',
                  padding: '2px 7px',
                  borderRadius: 10,
                  fontWeight: 700
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* CONTENIDO SEGÚN PESTAÑA */}
        <div style={{ padding: 18 }}>
          {/* TAB 1, 2, 3: TABLAS DE INGRESOS */}
          {(activeTab === 'todos' || activeTab === 'cuotas' || activeTab === 'iniciales') && (
            <div>
              {/* FILTROS Y BÚSQUEDA */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="search-input"
                    style={{ paddingLeft: 36, width: '100%' }}
                    placeholder="Buscar por lote, cliente, cédula o asesor..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  />
                </div>

                {/* Filtro Asesor */}
                <select
                  className="filter-select"
                  style={{ minWidth: 160 }}
                  value={asesorFilter}
                  onChange={(e) => { setAsesorFilter(e.target.value); setPage(1); }}
                >
                  <option value="TODOS">Todos los Asesores</option>
                  {asesoresDisponibles.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>

                {/* Filtro Medio */}
                <select
                  className="filter-select"
                  style={{ minWidth: 150 }}
                  value={medioFilter}
                  onChange={(e) => { setMedioFilter(e.target.value); setPage(1); }}
                >
                  <option value="TODOS">Todos los Medios</option>
                  {mediosDisponibles.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  Mostrando <strong>{filteredItems.length}</strong> pagos · Total filtrado: <strong style={{ color: '#16a34a' }}>{formatCOP(totalFiltrado)}</strong>
                </div>
              </div>

              {/* TABLA PRINCIPAL */}
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', fontSize: 11, textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>FECHA DE PAGO</th>
                      <th style={{ padding: '8px 10px' }}>ID LOTE</th>
                      <th style={{ padding: '8px 10px' }}>CLIENTE / TITULAR</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>CÉDULA</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>CONCEPTO</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>FECHA VENC.</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>VALOR PAGADO</th>
                      <th style={{ padding: '8px 10px' }}>MEDIO DE PAGO</th>
                      <th style={{ padding: '8px 10px' }}>ASESOR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: 8 }} />
                          Cargando recaudos del periodo...
                        </td>
                      </tr>
                    ) : paginatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                          No se encontraron pagos registrados con fecha de pago en este periodo o con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      paginatedItems.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* FECHA DE PAGO (DESTACADA) */}
                          <td style={{ padding: '9px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              display: 'inline-block'
                            }}>
                              {formatDate(item.fecha_pago)}
                            </span>
                          </td>

                          {/* ID LOTE */}
                          <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                            {item.lote}
                          </td>

                          {/* CLIENTE */}
                          <td style={{ padding: '9px 10px', fontWeight: 500, color: '#1e293b' }}>
                            <div>{item.cliente}</div>
                            {item.celular && (
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>{item.celular}</div>
                            )}
                          </td>

                          {/* CÉDULA */}
                          <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>
                            {item.doc_cliente}
                          </td>

                          {/* CONCEPTO */}
                          <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                            <span style={{
                              background: item.tipo === 'CUOTA_INICIAL' ? '#ede9fe' : '#f1f5f9',
                              color: item.tipo === 'CUOTA_INICIAL' ? '#7c3aed' : '#475569',
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontWeight: 600,
                              fontSize: 10
                            }}>
                              {item.concepto}
                            </span>
                          </td>

                          {/* FECHA VENCIMIENTO */}
                          <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>
                            {formatDate(item.fecha_vencimiento)}
                          </td>

                          {/* VALOR PAGADO */}
                          <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#15803d', fontSize: 12 }}>
                            {formatCOP(item.valor)}
                          </td>

                          {/* MEDIO DE PAGO */}
                          <td style={{ padding: '9px 10px', fontSize: 11, color: '#475569' }}>
                            {item.medio_pago}
                          </td>

                          {/* ASESOR */}
                          <td style={{ padding: '9px 10px', fontSize: 11, color: '#334155', whiteSpace: 'nowrap' }}>
                            {item.vendedor}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINACIÓN */}
              {totalPages > 1 && (
                <div style={{ marginTop: 14 }}>
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RANKING POR ASESOR */}
          {activeTab === 'asesores' && (
            <div>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                Distribución del dinero real recaudado en el mes según el asesor comercial asignado al contrato.
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', fontSize: 11 }}>
                      <th style={{ padding: '8px 10px', width: 40, textAlign: 'center' }}>#</th>
                      <th style={{ padding: '8px 10px' }}>ASESOR COMERCIAL</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>TOTAL RECAUDADO</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>% PARTICIPACIÓN</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}># TRANSACCIONES</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>CUOTAS ($)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>INICIALES ($)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>LOTES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.rankingAsesores || []).map((a, idx) => (
                      <tr key={a.vendedor} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: idx < 3 ? '#16a34a' : '#94a3b8' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>
                          {a.vendedor}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#15803d', fontSize: 13 }}>
                          {formatCOP(a.totalRecaudado)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                            <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, a.pctDelTotal)}%`, height: '100%', background: '#16a34a' }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{a.pctDelTotal.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                          {a.totalTransacciones}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                          {formatCOP(a.totalCuotas)} ({a.countCuotas})
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#7c3aed', fontWeight: 500 }}>
                          {formatCOP(a.totalIniciales)} ({a.countIniciales})
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>
                          {a.lotesCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: MEDIOS DE PAGO */}
          {activeTab === 'medios' && (
            <div>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                Canales por los cuales los clientes efectuaron sus pagos (consignaciones, transferencias bancarias o efectivo).
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {(data?.desgloseMedios || []).map(m => (
                  <div key={m.medio} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCard size={17} color="#2563eb" />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                          {m.medio}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 6 }}>
                        {m.pct.toFixed(1)}%
                      </span>
                    </div>

                    <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginBottom: 4 }}>
                      {formatCOP(m.total)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {m.count} transacciones de pago registradas
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: CALENDARIO / RECAUDO DIARIO */}
          {activeTab === 'diario' && (
            <div>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                Evolución diaria de las entradas de dinero durante el período <strong>{periodoLabel}</strong>.
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', fontSize: 11 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>DÍA</th>
                      <th style={{ padding: '8px 10px' }}>FECHA</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>CUOTAS ($)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>INICIALES ($)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>TOTAL ENTRADO</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}># PAGOS</th>
                      <th style={{ padding: '8px 10px', width: 220 }}>INTENSIDAD DE RECAUDO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recaudoPorDia || []).map(d => {
                      const maxDia = Math.max(1, ...(data.recaudoPorDia.map(x => x.totalDia)));
                      const barPct = (d.totalDia / maxDia) * 100;
                      return (
                        <tr key={d.fecha} style={{ borderBottom: '1px solid #f1f5f9', background: d.totalDia > 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: d.totalDia > 0 ? '#16a34a' : '#94a3b8' }}>
                            Día {d.dia}
                          </td>
                          <td style={{ padding: '7px 10px', color: '#475569' }}>
                            {d.fecha}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#334155' }}>
                            {d.cuotasMonto > 0 ? formatCOP(d.cuotasMonto) : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#7c3aed' }}>
                            {d.inicialesMonto > 0 ? formatCOP(d.inicialesMonto) : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: d.totalDia > 0 ? '#15803d' : '#94a3b8' }}>
                            {d.totalDia > 0 ? formatCOP(d.totalDia) : '$0'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, color: d.count > 0 ? '#1e293b' : '#cbd5e1' }}>
                            {d.count}
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            {d.totalDia > 0 && (
                              <div style={{ height: 8, width: `${Math.min(100, Math.max(4, barPct))}%`, background: '#16a34a', borderRadius: 4 }} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: LOTES SALDADOS */}
          {activeTab === 'saldados' && (
            <div>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                Lotes que quedaron <strong>completamente pagados</strong> durante el período {periodoLabel}.
              </div>
              {(data?.lotesCompletamentePagados || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No se registraron lotes completamente saldados en este período.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f0fdf4', color: '#166534', fontSize: 11 }}>
                        <th style={{ padding: '8px 10px' }}>LOTE</th>
                        <th style={{ padding: '8px 10px' }}>CLIENTE</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>CÉDULA</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>PRECIO TOTAL</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>TOTAL PAGADO</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>ÚLTIMO PAGO</th>
                        <th style={{ padding: '8px 10px' }}>ASESOR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.lotesCompletamentePagados || []).map(l => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #dcfce7', background: '#f0fdf4' }}>
                          <td style={{ padding: '10px', fontWeight: 700, color: '#15803d', fontFamily: 'monospace' }}>
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 6, fontSize: 11, marginRight: 8, fontWeight: 700 }}>✅ SALDADO</span>
                            {l.lote}
                          </td>
                          <td style={{ padding: '10px', fontWeight: 500 }}>{l.cliente}</td>
                          <td style={{ padding: '10px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>{l.doc_cliente}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>{formatCOP(l.precio_total)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{formatCOP(l.total_pagado)}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                              {formatDate(l.fecha_ultimo_pago)}
                            </span>
                          </td>
                          <td style={{ padding: '10px', fontSize: 11, color: '#334155' }}>{l.vendedor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}