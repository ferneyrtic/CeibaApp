import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Users, Plus, Search, RefreshCw, Calendar,
  CreditCard, FileText, FileSpreadsheet, CheckCircle2,
  Clock, AlertCircle, ArrowUpRight, UserCheck, Receipt,
  Building2, Filter, X
} from 'lucide-react';
import { getComisionesData, registrarPagoComision } from '../lib/api/comisionesApi';
import { formatCOP, formatDate } from '../utils/helpers';
import Modal from '../components/Modal';

export default function Comisiones() {
  const [data, setData] = useState({ asesores: [], pagos: [], ventas: [], kpis: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('historial'); // 'historial' | 'asesores'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAsesor, setFilterAsesor] = useState('TODOS');
  const [filterMedio, setFilterMedio] = useState('TODOS');
  const [modalOpen, setModalOpen] = useState(false);
  const [preselectedAsesor, setPreselectedAsesor] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadData = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getComisionesData(force);
      setData(res);
    } catch (err) {
      console.error('Error cargando datos de comisiones:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const { asesores, pagos, ventas, kpis } = data;

  // Filtrado de Historial de Pagos
  const filteredPagos = useMemo(() => {
    return pagos.filter(p => {
      const matchAsesor = filterAsesor === 'TODOS' || (p.vendedor_nombre || '').toUpperCase() === filterAsesor.toUpperCase();
      const matchMedio  = filterMedio === 'TODOS' || (p.medio_pago || '').toUpperCase() === filterMedio.toUpperCase();
      const s = searchTerm.toLowerCase().trim();
      const matchSearch = !s || (
        (p.vendedor_nombre || '').toLowerCase().includes(s) ||
        (p.comprobante || '').toLowerCase().includes(s) ||
        (p.lote || '').toLowerCase().includes(s) ||
        (p.observacion || '').toLowerCase().includes(s)
      );
      return matchAsesor && matchMedio && matchSearch;
    });
  }, [pagos, filterAsesor, filterMedio, searchTerm]);

  // Filtrado de Balance de Asesores
  const filteredAsesores = useMemo(() => {
    return asesores.filter(a => {
      const s = searchTerm.toLowerCase().trim();
      return !s || a.nombre.toLowerCase().includes(s);
    });
  }, [asesores, searchTerm]);

  const handleOpenModal = (asesorNombre = '') => {
    setPreselectedAsesor(asesorNombre);
    setModalOpen(true);
  };

  const handlePagoGuardado = (nuevoPago) => {
    setModalOpen(false);
    loadData(true);
  };

  // Exportaciones
  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Hoja 1: Historial de Pagos
      const pagosRows = pagos.map(p => ({
        'Fecha Pago': formatDate(p.fecha_pago),
        'Asesor Comercial': p.vendedor_nombre,
        'Valor Pagado': p.valor,
        'Medio de Pago': p.medio_pago,
        'Lote Asignado': p.lote || 'General',
        'N° Comprobante / Ref': p.comprobante || '—',
        'Concepto / Observaciones': p.observacion || '—',
        'Fecha de Registro': formatDate(p.created_at),
      }));
      const wsPagos = XLSX.utils.json_to_sheet(pagosRows);
      XLSX.utils.book_append_sheet(wb, wsPagos, 'Historial de Pagos');

      // Hoja 2: Balance por Asesor
      const asesoresRows = asesores.map(a => ({
        'Asesor Comercial': a.nombre,
        '# Ventas': a.totalVentas,
        'Total Vendido': a.valorTotalVendido,
        'Comisiones Ganadas': a.totalComisiones,
        'Total Pagado / Anticipos': a.totalPagado,
        'Saldo Pendiente': a.saldoPendiente,
        '% Liquidado': `${a.porcentajeLiquidado}%`,
      }));
      const wsAsesores = XLSX.utils.json_to_sheet(asesoresRows);
      XLSX.utils.book_append_sheet(wb, wsAsesores, 'Balance Asesores');

      XLSX.writeFile(wb, `nomina_comisiones_laceiba_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      alert('Error exportando Excel: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

      // Cabecera
      doc.setFillColor(22, 101, 52); // Verde bosque #166534
      doc.rect(0, 0, doc.internal.pageSize.width, 70, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('REPORTE OFICIAL DE NÓMINA & PAGOS A COMISIONISTAS', 40, 32);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Proyecto La Ceiba · Generado el ${new Date().toLocaleDateString('es-CO')} · Total Desembolsado: ${formatCOP(kpis.totalLiquidadoPagado)}`, 40, 52);

      // Tabla de Resumen por Asesor
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Balance General de Comisiones por Asesor', 40, 95);

      const tableDataAsesores = asesores.slice(0, 25).map(a => [
        a.nombre,
        a.totalVentas,
        formatCOP(a.valorTotalVendido),
        formatCOP(a.totalComisiones),
        formatCOP(a.totalPagado),
        formatCOP(a.saldoPendiente),
        `${a.porcentajeLiquidado}%`,
      ]);

      autoTable(doc, {
        startY: 105,
        head: [['Asesor Comercial', 'Ventas', 'Total Vendido', 'Comisión Ganada', 'Pagado', 'Saldo Pendiente', '% Liq']],
        body: tableDataAsesores,
        theme: 'striped',
        headStyles: { fillColor: [22, 101, 52], fontSize: 9 },
        bodyStyles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 140 },
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'center' },
        },
      });

      // Tabla de Historial de Pagos
      const finalY = doc.lastAutoTable.finalY + 25;
      if (finalY < doc.internal.pageSize.height - 120) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('2. Últimos Pagos Registrados a Comisionistas', 40, finalY);

        const tableDataPagos = pagos.slice(0, 20).map(p => [
          formatDate(p.fecha_pago),
          p.vendedor_nombre,
          formatCOP(p.valor),
          p.medio_pago,
          p.lote || 'General',
          p.comprobante || '—',
        ]);

        autoTable(doc, {
          startY: finalY + 10,
          head: [['Fecha', 'Asesor', 'Valor Pagado', 'Medio', 'Lote', 'Comprobante']],
          body: tableDataPagos,
          theme: 'striped',
          headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
          bodyStyles: { fontSize: 8.5 },
          columnStyles: {
            2: { halign: 'right' },
          },
        });
      }

      doc.save(`reporte_nomina_comisiones_laceiba_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      alert('Error exportando PDF: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Header Principal */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Nómina & Pagos de Comisionistas</span>
            <span style={{ fontSize: 12, padding: '3px 8px', background: '#dcfce7', color: '#166534', borderRadius: 6, fontWeight: 700 }}>
              AUDITABLE
            </span>
          </div>
          <div className="page-subtitle">
            Control de comisiones devengadas, registro de anticipos y liquidaciones a asesores comerciales.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => loadData(true)}
            title="Refrescar datos"
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>

          <button
            className="btn btn-secondary"
            onClick={exportExcel}
            disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <FileSpreadsheet size={14} color="#16a34a" />
            Excel
          </button>

          <button
            className="btn btn-secondary"
            onClick={exportPDF}
            disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <FileText size={14} color="#dc2626" />
            PDF
          </button>

          <button
            className="btn btn-primary"
            onClick={() => handleOpenModal()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
          >
            <Plus size={16} />
            Registrar Pago
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><DollarSign size={18} /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{formatCOP(kpis.totalComisionesProyecto || 0)}</div>
          <div className="kpi-label">Total Comisiones Ganadas</div>
          <div className="kpi-change up">
            <CheckCircle2 size={11} />
            {asesores.length} asesores con ventas
          </div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-icon green"><CreditCard size={18} /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{formatCOP(kpis.totalLiquidadoPagado || 0)}</div>
          <div className="kpi-label">Total Liquidado / Pagado</div>
          <div className="kpi-change up">
            <Receipt size={11} />
            {pagos.length} pagos registrados
          </div>
        </div>

        <div className="kpi-card purple">
          <div className="kpi-icon purple"><Clock size={18} /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{formatCOP(kpis.saldoTotalPendiente || 0)}</div>
          <div className="kpi-label">Saldo Pendiente por Pagar</div>
          <div className="kpi-change warn">
            <Users size={11} />
            A liquidar según recaudo
          </div>
        </div>

        <div className="kpi-card yellow">
          <div className="kpi-icon yellow"><Calendar size={18} /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{formatCOP(kpis.totalPagadoMesActual || 0)}</div>
          <div className="kpi-label">Pagos Realizados Este Mes</div>
          <div className="kpi-change up">
            <ArrowUpRight size={11} />
            {kpis.pagosMesActualCount || 0} desembolsos
          </div>
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '2px solid var(--border-light)',
        marginBottom: 20,
        gap: 16,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('historial')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'historial' ? 800 : 600,
              fontSize: 14,
              color: activeTab === 'historial' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'historial' ? '3px solid var(--accent)' : '3px solid transparent',
              marginBottom: -2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <Receipt size={16} />
            Historial de Pagos Realizados
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'historial' ? 'var(--accent-soft)' : 'var(--bg-secondary)',
              color: activeTab === 'historial' ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 700,
            }}>
              {pagos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('asesores')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'asesores' ? 800 : 600,
              fontSize: 14,
              color: activeTab === 'asesores' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'asesores' ? '3px solid var(--accent)' : '3px solid transparent',
              marginBottom: -2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <Users size={16} />
            Balance por Comisionista
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'asesores' ? 'var(--accent-soft)' : 'var(--bg-secondary)',
              color: activeTab === 'asesores' ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 700,
            }}>
              {asesores.length}
            </span>
          </button>
        </div>

        {/* Buscador Rápido */}
        <div style={{ position: 'relative', width: 280, marginBottom: 8 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="search-input"
            style={{ width: '100%', paddingLeft: 34, fontSize: 13 }}
            placeholder={activeTab === 'historial' ? 'Buscar en pagos, asesor, lote...' : 'Buscar asesor comercial...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* CONTENIDO TAB 1: HISTORIAL DE PAGOS */}
      {activeTab === 'historial' && (
        <div>
          {/* Filtros de la tabla */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
              <Filter size={14} />
              <span>Filtrar por:</span>
            </div>

            <select
              className="filter-select"
              value={filterAsesor}
              onChange={(e) => setFilterAsesor(e.target.value)}
              style={{ fontSize: 13, minWidth: 200 }}
            >
              <option value="TODOS">Todos los Comisionistas ({asesores.length})</option>
              {asesores.map(a => (
                <option key={a.nombre} value={a.nombre}>{a.nombre}</option>
              ))}
            </select>

            <select
              className="filter-select"
              value={filterMedio}
              onChange={(e) => setFilterMedio(e.target.value)}
              style={{ fontSize: 13, minWidth: 180 }}
            >
              <option value="TODOS">Todos los Medios de Pago</option>
              <option value="TRANSFERENCIA BANCARIA">Transferencia Bancaria</option>
              <option value="BANCOLOMBIA">Bancolombia</option>
              <option value="NEQUI">Nequi</option>
              <option value="DAVIPLATA">Daviplata</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="CHEQUE">Cheque</option>
            </select>

            {(filterAsesor !== 'TODOS' || filterMedio !== 'TODOS' || searchTerm) && (
              <button
                className="btn btn-ghost"
                onClick={() => { setFilterAsesor('TODOS'); setFilterMedio('TODOS'); setSearchTerm(''); }}
                style={{ fontSize: 12, color: '#dc2626', padding: '4px 8px' }}
              >
                Limpiar filtros
              </button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
              Mostrando <strong>{filteredPagos.length}</strong> de {pagos.length} pagos registrados
            </div>
          </div>

          {/* Tabla de Pagos */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Fecha Pago</th>
                    <th>Asesor / Comisionista</th>
                    <th style={{ textAlign: 'right' }}>Valor Pagado</th>
                    <th>Medio de Pago</th>
                    <th>Lote Asociado</th>
                    <th>Comprobante / Ref</th>
                    <th>Concepto / Observación</th>
                    <th style={{ width: 130 }}>Registrado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPagos.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                          No hay pagos registrados que coincidan con el filtro
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 16 }}>
                          Registra un nuevo desembolso para comenzar el control de nómina de comisiones.
                        </div>
                        <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ fontSize: 13 }}>
                          <Plus size={14} /> Registrar Primer Pago
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredPagos.map((p, idx) => (
                      <tr key={p.id || idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatDate(p.fecha_pago)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {p.vendedor_nombre}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            fontWeight: 800,
                            color: '#166534',
                            background: '#dcfce7',
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 13,
                          }}>
                            {formatCOP(p.valor)}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 12,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                          }}>
                            {p.medio_pago || 'TRANSFERENCIA'}
                          </span>
                        </td>
                        <td>
                          {p.lote ? (
                            <span style={{ fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                              {p.lote}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>General</span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {p.comprobante || '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 260 }}>
                          {p.observacion || 'Liquidación de comisión'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {p.created_at ? formatDate(p.created_at) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 2: BALANCE POR COMISIONISTA */}
      {activeTab === 'asesores' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asesor Comercial</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Ventas</th>
                  <th style={{ textAlign: 'right' }}>Total Vendido</th>
                  <th style={{ textAlign: 'right' }}>Comisiones Ganadas</th>
                  <th style={{ textAlign: 'right' }}>Total Pagado</th>
                  <th style={{ textAlign: 'right' }}>Saldo Pendiente</th>
                  <th style={{ width: 140, textAlign: 'center' }}>% Liquidado</th>
                  <th style={{ width: 120, textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredAsesores.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      No se encontraron asesores con ese nombre.
                    </td>
                  </tr>
                ) : (
                  filteredAsesores.map((a) => (
                    <tr key={a.nombre}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                          {a.nombre}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Comisión contractual: ~{a.porcentaje}%
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        <span style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 10, fontSize: 12 }}>
                          {a.totalVentas}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCOP(a.valorTotalVendido)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                        {formatCOP(a.totalComisiones)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {formatCOP(a.totalPagado)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: a.saldoPendiente > 0 ? '#d97706' : '#16a34a' }}>
                        {formatCOP(a.saldoPendiente)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${a.porcentajeLiquidado}%`,
                              height: '100%',
                              background: a.porcentajeLiquidado >= 100 ? '#16a34a' : 'linear-gradient(90deg, #3b82f6, #10b981)',
                              borderRadius: 4,
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>
                            {a.porcentajeLiquidado}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleOpenModal(a.nombre)}
                          style={{ fontSize: 11, padding: '5px 10px', gap: 4 }}
                          title={`Registrar pago a ${a.nombre}`}
                        >
                          <Plus size={12} /> Pagar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PAGO A COMISIONISTA */}
      {modalOpen && (
        <RegistrarPagoModal
          asesores={asesores}
          ventas={ventas}
          initialAsesor={preselectedAsesor}
          onClose={() => setModalOpen(false)}
          onSuccess={handlePagoGuardado}
        />
      )}
    </div>
  );
}

// =============================================
// COMPONENTE MODAL: REGISTRAR PAGO
// =============================================
function RegistrarPagoModal({ asesores, ventas, initialAsesor, onClose, onSuccess }) {
  const [vendedorNombre, setVendedorNombre] = useState(initialAsesor || (asesores[0]?.nombre || ''));
  const [valor, setValor] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA BANCOLOMBIA');
  const [lote, setLote] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Asesor seleccionado actualmente para mostrar su saldo
  const asesorSelected = useMemo(() => {
    return asesores.find(a => a.nombre.toUpperCase() === vendedorNombre.toUpperCase());
  }, [asesores, vendedorNombre]);

  // Lotes vendidos por este asesor
  const lotesDelAsesor = useMemo(() => {
    if (!vendedorNombre) return [];
    return ventas
      .filter(v => (v.vendedor_nombre || '').toUpperCase() === vendedorNombre.toUpperCase())
      .map(v => v.lotes?.id_lote)
      .filter(Boolean);
  }, [ventas, vendedorNombre]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const valNum = parseFloat(valor.replace(/[^0-9]/g, ''));
    if (!vendedorNombre) {
      setErrorMsg('Debes seleccionar un asesor comercial.');
      return;
    }
    if (!valNum || valNum <= 0) {
      setErrorMsg('Debes ingresar un valor válido mayor a $0.');
      return;
    }
    if (!fechaPago) {
      setErrorMsg('Debes seleccionar la fecha del pago.');
      return;
    }

    setSaving(true);
    try {
      const nuevoPago = await registrarPagoComision({
        vendedor_nombre: vendedorNombre,
        valor: valNum,
        fecha_pago: fechaPago,
        medio_pago: medioPago,
        lote: lote || null,
        comprobante: comprobante || null,
        observacion: observacion || `Pago de comisión a ${vendedorNombre}`,
      });
      onSuccess(nuevoPago);
    } catch (err) {
      console.error('Error guardando pago:', err);
      setErrorMsg('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="💳 Registrar Pago de Comisión a Asesor" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {errorMsg && (
          <div className="alert-banner red" style={{ margin: 0 }}>
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}

        {/* Info del Asesor y Saldo Pendiente */}
        <div>
          <label className="form-label" style={{ fontWeight: 700 }}>
            Asesor Comercial / Comisionista *
          </label>
          <select
            className="form-input"
            value={vendedorNombre}
            onChange={(e) => setVendedorNombre(e.target.value)}
            required
            style={{ fontWeight: 700 }}
          >
            <option value="">-- Selecciona un Asesor --</option>
            {asesores.map(a => (
              <option key={a.nombre} value={a.nombre}>
                {a.nombre} (Saldo Pendiente: {formatCOP(a.saldoPendiente)})
              </option>
            ))}
          </select>
        </div>

        {asesorSelected && (
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Comisiones Ganadas: </span>
              <strong style={{ color: '#2563eb' }}>{formatCOP(asesorSelected.totalComisiones)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total Pagado: </span>
              <strong style={{ color: '#16a34a' }}>{formatCOP(asesorSelected.totalPagado)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Saldo Pendiente: </span>
              <strong style={{ color: '#d97706' }}>{formatCOP(asesorSelected.saldoPendiente)}</strong>
            </div>
          </div>
        )}

        {/* Valor y Fecha */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label" style={{ fontWeight: 700 }}>
              Valor a Pagar ($ COP) *
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: 1.500.000"
              value={valor ? `$ ${Number(valor.replace(/[^0-9]/g, '')).toLocaleString('es-CO')}` : ''}
              onChange={(e) => setValor(e.target.value.replace(/[^0-9]/g, ''))}
              required
              style={{ fontSize: 16, fontWeight: 800, color: '#166534' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 700 }}>
              Fecha del Pago *
            </label>
            <input
              type="date"
              className="form-input"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Medio de Pago y Lote */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label">Medio de Pago *</label>
            <select
              className="form-input"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
            >
              <option value="TRANSFERENCIA BANCOLOMBIA">Transferencia Bancolombia</option>
              <option value="TRANSFERENCIA DAVIVIENDA">Transferencia Davivienda</option>
              <option value="TRANSFERENCIA BBVA">Transferencia BBVA</option>
              <option value="NEQUI">Nequi</option>
              <option value="DAVIPLATA">Daviplata</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div>
            <label className="form-label">Lote / Venta Imputada (Opcional)</label>
            {lotesDelAsesor.length > 0 ? (
              <select
                className="form-input"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
              >
                <option value="">-- General / Sin Lote Específico --</option>
                {lotesDelAsesor.map(l => (
                  <option key={l} value={l}>Lote {l}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-input"
                placeholder="Ej: LC2 - 14 - 5"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* Comprobante */}
        <div>
          <label className="form-label">N° de Comprobante / Referencia Bancaria (Opcional)</label>
          <input
            type="text"
            className="form-input"
            placeholder="Ej: APROB-984214 o REC-0042"
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value)}
          />
        </div>

        {/* Observaciones */}
        <div>
          <label className="form-label">Concepto / Observaciones (Opcional)</label>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Ej: Anticipo 50% comisión Lote LC2-14-5 venta cliente Juan Pérez"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Guardar Pago
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
