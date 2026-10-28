import React, { useState, useMemo } from 'react';
import {
  User, DollarSign, CreditCard, Clock, Calendar, CheckCircle2,
  FileSpreadsheet, FileText, Plus, Search, X, AlertCircle,
  Receipt, ArrowUpRight, Percent, Phone, Tag, Building2,
  ChevronRight, Sparkles, ShieldCheck
} from 'lucide-react';
import { formatCOP, formatDate } from '../utils/helpers';

/**
 * Vista de Trabajo Completa para un Asesor Comercial en su pestaña individual de Chrome.
 */
export default function AsesorDetalleView({
  asesor,
  canDisburse = false,
  onRegistrarPago,
  onClose,
}) {
  const [subTab, setSubTab] = useState('ventas'); // 'ventas' | 'pagos'
  const [searchVenta, setSearchVenta] = useState('');
  const [searchPago, setSearchPago] = useState('');
  const [exporting, setExporting] = useState(false);

  if (!asesor) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle size={40} color="#dc2626" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700 }}>Asesor no encontrado</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
          La información de este asesor comercial no se encuentra disponible.
        </p>
      </div>
    );
  }

  const {
    nombre,
    porcentaje = 5,
    totalVentas = 0,
    valorTotalVendido = 0,
    totalComisiones = 0,
    totalPagado = 0,
    saldoPendiente = 0,
    anticipoAFavor = 0,
    porcentajeLiquidado = 0,
    ventas = [],
    pagos = [],
  } = asesor;

  // Filtrado de Lotes/Ventas del asesor
  const filteredVentas = useMemo(() => {
    const s = searchVenta.toLowerCase().trim();
    if (!s) return ventas;
    return ventas.filter(v => {
      const loteStr = (v.lotes?.id_lote || '').toLowerCase();
      const cliStr = (v.clientes?.nombre || '').toLowerCase();
      const celStr = (v.clientes?.celular || '').toLowerCase();
      return loteStr.includes(s) || cliStr.includes(s) || celStr.includes(s);
    });
  }, [ventas, searchVenta]);

  // Filtrado de Pagos del asesor
  const filteredPagos = useMemo(() => {
    const s = searchPago.toLowerCase().trim();
    if (!s) return pagos;
    return pagos.filter(p => {
      const medio = (p.medio_pago || '').toLowerCase();
      const lote = (p.lote || '').toLowerCase();
      const comp = (p.comprobante || '').toLowerCase();
      const obs = (p.observacion || '').toLowerCase();
      return medio.includes(s) || lote.includes(s) || comp.includes(s) || obs.includes(s);
    });
  }, [pagos, searchPago]);

  // Totales calculados de ventas filtradas
  const sumFilteredVentas = useMemo(() => {
    return filteredVentas.reduce((acc, v) => acc + (v.precio_venta || 0), 0);
  }, [filteredVentas]);

  const sumFilteredComisiones = useMemo(() => {
    return filteredVentas.reduce((acc, v) => acc + (v.comision_vendedor || 0), 0);
  }, [filteredVentas]);

  // Totales calculados de pagos filtrados
  const sumFilteredPagos = useMemo(() => {
    return filteredPagos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
  }, [filteredPagos]);

  // Exportar Excel Individual
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen
      const resumenData = [
        { 'CONCEPTO': 'Asesor Comercial', 'DETALLE': nombre },
        { 'CONCEPTO': 'Comisión Contractual', 'DETALLE': `${porcentaje}%` },
        { 'CONCEPTO': 'Total Lotes Vendidos', 'DETALLE': totalVentas },
        { 'CONCEPTO': 'Valor Total Negociado', 'DETALLE': valorTotalVendido },
        { 'CONCEPTO': 'Comisiones Ganadas', 'DETALLE': totalComisiones },
        { 'CONCEPTO': 'Total Pagado / Anticipos', 'DETALLE': totalPagado },
        { 'CONCEPTO': 'Saldo Pendiente', 'DETALLE': saldoPendiente },
        { 'CONCEPTO': 'Porcentaje Liquidado', 'DETALLE': `${porcentajeLiquidado}%` },
        { 'CONCEPTO': 'Fecha de Reporte', 'DETALLE': new Date().toLocaleDateString('es-CO') },
      ];
      const wsResumen = XLSX.utils.json_to_sheet(resumenData);
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Asesor');

      // Hoja 2: Lotes y Ventas
      const ventasRows = ventas.map(v => ({
        'Lote': v.lotes?.id_lote || '—',
        'Cliente': v.clientes?.nombre || '—',
        'Celular': v.clientes?.celular || '—',
        'Fecha Venta': formatDate(v.fecha_venta),
        'Precio Venta': v.precio_venta || 0,
        'Cuota Inicial': v.valor_cuota_inicial || 0,
        'Saldo Lote': v.saldo || 0,
        'Comisión Ganada': v.comision_vendedor || 0,
      }));
      const wsVentas = XLSX.utils.json_to_sheet(ventasRows);
      XLSX.utils.book_append_sheet(wb, wsVentas, 'Lotes Vendidos');

      // Hoja 3: Pagos Realizados
      const pagosRows = pagos.map(p => ({
        'Fecha Pago': formatDate(p.fecha_pago),
        'Valor Pagado': p.valor || 0,
        'Medio de Pago': p.medio_pago || 'TRANSFERENCIA',
        'Lote Asignado': p.lote || 'General',
        'N° Comprobante / Ref': p.comprobante || '—',
        'Observación': p.observacion || '—',
        'Registrado En': formatDate(p.created_at),
      }));
      const wsPagos = XLSX.utils.json_to_sheet(pagosRows);
      XLSX.utils.book_append_sheet(wb, wsPagos, 'Historial de Pagos');

      const safeName = nombre.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      XLSX.writeFile(wb, `comisiones_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert('Error exportando Excel: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Exportar PDF Individual Oficial
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      const pageWidth = doc.internal.pageSize.width;

      // Encabezado Verde Bosque
      doc.setFillColor(22, 101, 52); // #166534
      doc.rect(0, 0, pageWidth, 75, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('PROYECTO CAMPESTRE LA CEIBA', 40, 30);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('ESTADO DE CUENTA Y LIQUIDACIÓN INDIVIDUAL DE COMISIONES', 40, 48);

      doc.setFontSize(9);
      doc.text(`Generado el: ${new Date().toLocaleDateString('es-CO', { dateStyle: 'long' })}`, 40, 64);

      // Cuadro de Resumen del Asesor
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(40, 90, pageWidth - 80, 70, 6, 6, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Asesor: ${nombre}`, 54, 110);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Tasa contractual: ~${porcentaje}%  ·  Lotes cerrados: ${totalVentas}  ·  Estado: ${saldoPendiente > 0 ? 'SALDO PENDIENTE' : 'AL DÍA'}`, 54, 126);

      // Métricas clave dentro del cuadro
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 64, 175);
      doc.text(`Total Vendido: ${formatCOP(valorTotalVendido)}`, 54, 146);

      doc.setTextColor(22, 101, 52);
      doc.text(`Comisión: ${formatCOP(totalComisiones)}`, 220, 146);

      doc.setTextColor(180, 83, 9);
      doc.text(`Pagado: ${formatCOP(totalPagado)}`, 360, 146);

      doc.setTextColor(220, 38, 38);
      doc.text(`Saldo: ${formatCOP(saldoPendiente)} (${porcentajeLiquidado}%)`, 470, 146);

      // Tabla 1: Lotes Vendidos
      let currentY = 175;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`1. Lotes Vendidos y Comisiones Devengadas (${ventas.length})`, 40, currentY);

      const tableDataVentas = ventas.map(v => [
        v.lotes?.id_lote || '—',
        v.clientes?.nombre || '—',
        formatDate(v.fecha_venta),
        formatCOP(v.precio_venta),
        formatCOP(v.comision_vendedor),
        formatCOP(v.saldo),
      ]);

      autoTable(doc, {
        startY: currentY + 8,
        head: [['Lote', 'Cliente', 'Fecha Venta', 'Precio Lote', 'Comisión Ganada', 'Saldo Contrato']],
        body: tableDataVentas,
        theme: 'striped',
        headStyles: { fillColor: [22, 101, 52], fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'right' },
        },
        foot: [[
          'TOTALES',
          `${ventas.length} Lotes`,
          '',
          formatCOP(valorTotalVendido),
          formatCOP(totalComisiones),
          '',
        ]],
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5 },
      });

      // Tabla 2: Pagos y Desembolsos
      currentY = doc.lastAutoTable.finalY + 25;
      if (currentY > doc.internal.pageSize.height - 180) {
        doc.addPage();
        currentY = 40;
      }

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`2. Historial de Pagos y Anticipos Realizados (${pagos.length})`, 40, currentY);

      const tableDataPagos = pagos.map(p => [
        formatDate(p.fecha_pago),
        formatCOP(p.valor),
        p.medio_pago || 'TRANSFERENCIA',
        p.lote ? `Lote ${p.lote}` : 'General',
        p.comprobante || '—',
        p.observacion || 'Pago de comisión',
      ]);

      autoTable(doc, {
        startY: currentY + 8,
        head: [['Fecha Pago', 'Valor Desembolsado', 'Medio de Pago', 'Imputación', 'Comprobante', 'Observación']],
        body: tableDataPagos.length > 0 ? tableDataPagos : [['—', '—', 'Sin pagos registrados', '—', '—', '—']],
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175], fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          1: { halign: 'right', fontStyle: 'bold' },
        },
        foot: [[
          'TOTAL DESEMBOLSADO',
          formatCOP(totalPagado),
          `${pagos.length} Pagos`,
          '',
          'SALDO PENDIENTE:',
          formatCOP(saldoPendiente),
        ]],
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5 },
      });

      // Bloque de Firmas
      let signY = doc.lastAutoTable.finalY + 45;
      if (signY > doc.internal.pageSize.height - 100) {
        doc.addPage();
        signY = 70;
      }

      doc.setDrawColor(156, 163, 175);
      doc.line(60, signY + 30, 240, signY + 30);
      doc.line(pageWidth - 240, signY + 30, pageWidth - 60, signY + 30);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('RECIBÍ CONFORME (ASESOR)', 75, signY + 45);
      doc.text('AUTORIZADO (ADMINISTRACIÓN)', pageWidth - 230, signY + 45);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(`C.C. / Asesor: ${nombre}`, 75, signY + 58);
      doc.text('Proyecto Campestre La Ceiba', pageWidth - 230, signY + 58);

      const safeName = nombre.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      doc.save(`liquidacion_oficial_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      alert('Error exportando PDF: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
      {/* BANNER PRINCIPAL DEL ASESOR */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          marginBottom: 20,
          background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-card2) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          {/* Avatar e Identificación */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #16a34a, #059669)',
              color: '#ffffff',
              fontSize: 22,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
              flexShrink: 0,
            }}>
              {nombre.charAt(0).toUpperCase()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {nombre}
                </h2>
                <span style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                }}>
                  Comisión: ~{porcentaje}%
                </span>
                {saldoPendiente > 0 ? (
                  <span style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#fef3c7',
                    color: '#92400e',
                    fontWeight: 700,
                  }}>
                    ⏳ Saldo Pendiente: {formatCOP(saldoPendiente)}
                  </span>
                ) : (
                  <span style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#dcfce7',
                    color: '#166534',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <CheckCircle2 size={12} /> Al Día (100% Liquidado)
                  </span>
                )}
                {anticipoAFavor > 0 && (
                  <span style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#dbeafe',
                    color: '#1e40af',
                    fontWeight: 700,
                  }}>
                    Anticipo a favor: {formatCOP(anticipoAFavor)}
                  </span>
                )}
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Ficha individual de nómina · {totalVentas} contratos cerrados · {pagos.length} desembolsos auditados
              </div>
            </div>
          </div>

          {/* Botones de Acción de esta Ficha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {canDisburse && (
              <button
                className="btn btn-primary"
                onClick={() => onRegistrarPago(nombre)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
              >
                <Plus size={15} />
                Registrar Pago / Anticipo
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={handleExportPDF}
              disabled={exporting}
              title="Descargar Liquidación Oficial PDF"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <FileText size={15} color="#dc2626" />
              Liquidación PDF
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleExportExcel}
              disabled={exporting}
              title="Exportar a Excel"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <FileSpreadsheet size={15} color="#16a34a" />
              Excel
            </button>

            <button
              className="btn btn-ghost"
              onClick={onClose}
              title="Cerrar esta pestaña"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}
            >
              <X size={14} />
              Cerrar
            </button>
          </div>
        </div>

        {/* Barra de Progreso de Liquidación */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              Progreso de Liquidación de Comisiones
            </span>
            <span style={{ fontWeight: 800, color: porcentajeLiquidado >= 100 ? '#16a34a' : 'var(--accent)' }}>
              {porcentajeLiquidado}% ({formatCOP(totalPagado)} de {formatCOP(totalComisiones)})
            </span>
          </div>
          <div style={{ width: '100%', height: 10, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, porcentajeLiquidado)}%`,
                height: '100%',
                background: porcentajeLiquidado >= 100
                  ? '#16a34a'
                  : 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)',
                borderRadius: 6,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* KPI CARDS INDIVIDUALES */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Building2 size={18} /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{formatCOP(valorTotalVendido)}</div>
          <div className="kpi-label">Total Vendido en Lotes</div>
          <div className="kpi-change up">
            <CheckCircle2 size={11} />
            {totalVentas} lotes negociados
          </div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-icon green"><DollarSign size={18} /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{formatCOP(totalComisiones)}</div>
          <div className="kpi-label">Comisiones Devengadas</div>
          <div className="kpi-change up">
            <Tag size={11} />
            Tasa pactada ~{porcentaje}%
          </div>
        </div>

        <div className="kpi-card purple">
          <div className="kpi-icon purple"><CreditCard size={18} /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{formatCOP(totalPagado)}</div>
          <div className="kpi-label">Total Liquidado / Pagado</div>
          <div className="kpi-change up">
            <Receipt size={11} />
            {pagos.length} pagos registrados
          </div>
        </div>

        <div className="kpi-card yellow">
          <div className="kpi-icon yellow"><Clock size={18} /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{formatCOP(saldoPendiente)}</div>
          <div className="kpi-label">Saldo Pendiente de Pago</div>
          <div className={`kpi-change ${saldoPendiente > 0 ? 'warn' : 'up'}`}>
            {saldoPendiente > 0 ? <AlertCircle size={11} /> : <CheckCircle2 size={11} />}
            {saldoPendiente > 0 ? 'Pendiente según recaudo' : 'Comisión totalmente al día'}
          </div>
        </div>
      </div>

      {/* SUB-PESTAÑAS DE TRABAJO: VENTAS VS PAGOS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '2px solid var(--border-light)',
        marginBottom: 20,
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setSubTab('ventas')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: subTab === 'ventas' ? 800 : 600,
              fontSize: 14,
              color: subTab === 'ventas' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: subTab === 'ventas' ? '3px solid var(--accent)' : '3px solid transparent',
              marginBottom: -2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <Tag size={16} />
            Lotes & Ventas Asignadas
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 12,
              background: subTab === 'ventas' ? 'var(--accent-soft)' : 'var(--bg-secondary)',
              color: subTab === 'ventas' ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 700,
            }}>
              {ventas.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('pagos')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: subTab === 'pagos' ? 800 : 600,
              fontSize: 14,
              color: subTab === 'pagos' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: subTab === 'pagos' ? '3px solid var(--accent)' : '3px solid transparent',
              marginBottom: -2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <Receipt size={16} />
            Historial de Pagos y Anticipos
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 12,
              background: subTab === 'pagos' ? 'var(--accent-soft)' : 'var(--bg-secondary)',
              color: subTab === 'pagos' ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 700,
            }}>
              {pagos.length}
            </span>
          </button>
        </div>

        {/* Buscador Contextual */}
        <div style={{ position: 'relative', width: 260, marginBottom: 8 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="search-input"
            style={{ width: '100%', paddingLeft: 34, fontSize: 13 }}
            placeholder={subTab === 'ventas' ? 'Buscar lote o cliente...' : 'Buscar pago, ref, comprobante...'}
            value={subTab === 'ventas' ? searchVenta : searchPago}
            onChange={(e) => {
              if (subTab === 'ventas') setSearchVenta(e.target.value);
              else setSearchPago(e.target.value);
            }}
          />
          {((subTab === 'ventas' && searchVenta) || (subTab === 'pagos' && searchPago)) && (
            <button
              onClick={() => {
                if (subTab === 'ventas') setSearchVenta('');
                else setSearchPago('');
              }}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* TAB SUB 1: LOTES & VENTAS ASIGNADAS */}
      {subTab === 'ventas' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Fecha Venta</th>
                  <th style={{ textAlign: 'right' }}>Precio de Venta</th>
                  <th style={{ textAlign: 'right' }}>Cuota Inicial</th>
                  <th style={{ textAlign: 'right' }}>Saldo Contrato</th>
                  <th style={{ textAlign: 'right' }}>Comisión Pactada</th>
                </tr>
              </thead>
              <tbody>
                {filteredVentas.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                      <Tag size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                      <div style={{ fontWeight: 700, fontSize: 14 }}>No hay ventas registradas para este filtro</div>
                    </td>
                  </tr>
                ) : (
                  filteredVentas.map((v, idx) => (
                    <tr key={v.id || idx}>
                      <td>
                        <span style={{
                          fontWeight: 800,
                          color: '#2563eb',
                          background: '#dbeafe',
                          padding: '3px 8px',
                          borderRadius: 5,
                          fontSize: 12,
                        }}>
                          {v.lotes?.id_lote || '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {v.clientes?.nombre || '—'}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {v.clientes?.celular ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={12} color="var(--text-muted)" />
                            {v.clientes.celular}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatDate(v.fecha_venta)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCOP(v.precio_venta)}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatCOP(v.valor_cuota_inicial)}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: v.saldo > 0 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                        {formatCOP(v.saldo)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 800,
                          color: '#166534',
                          background: '#dcfce7',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 13,
                        }}>
                          {formatCOP(v.comision_vendedor)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredVentas.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-secondary)', fontWeight: 800 }}>
                    <td colSpan={4}>TOTALES ({filteredVentas.length} Lotes)</td>
                    <td style={{ textAlign: 'right' }}>{formatCOP(sumFilteredVentas)}</td>
                    <td colSpan={2}></td>
                    <td style={{ textAlign: 'right', color: '#166534', fontSize: 14 }}>
                      {formatCOP(sumFilteredComisiones)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* TAB SUB 2: HISTORIAL DE PAGOS REALIZADOS */}
      {subTab === 'pagos' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Fecha Pago</th>
                  <th style={{ textAlign: 'right' }}>Valor Pagado</th>
                  <th>Medio de Pago</th>
                  <th>Lote Imputado</th>
                  <th>N° Comprobante / Ref</th>
                  <th>Concepto / Observaciones</th>
                  <th style={{ width: 120 }}>Registrado</th>
                </tr>
              </thead>
              <tbody>
                {filteredPagos.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                      <Receipt size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                      <div style={{ fontWeight: 700, fontSize: 14 }}>No hay pagos registrados para este asesor</div>
                      {canDisburse && (
                        <div style={{ marginTop: 12 }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => onRegistrarPago(nombre)}
                            style={{ fontSize: 12 }}
                          >
                            <Plus size={13} /> Registrar Primer Pago
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPagos.map((p, idx) => (
                    <tr key={p.id || idx}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatDate(p.fecha_pago)}
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
              {filteredPagos.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-secondary)', fontWeight: 800 }}>
                    <td>TOTAL DESEMBOLSADO</td>
                    <td style={{ textAlign: 'right', color: '#166534', fontSize: 14 }}>
                      {formatCOP(sumFilteredPagos)}
                    </td>
                    <td colSpan={5} style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {filteredPagos.length} pagos realizados
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
