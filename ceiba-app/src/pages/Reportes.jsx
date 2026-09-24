import React, { useState, useEffect } from 'react';
import {
  FileText, FileSpreadsheet, Download, TrendingUp, AlertTriangle,
  Building2, Users, RefreshCw, CheckCircle2, Search, UserCheck, Calculator, RotateCw, DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getReportesData, clearReportesCache } from '../lib/api/reportsApi';
import { formatCOP, formatDate, diasDesdeHoy } from '../utils/helpers';
import { exportEstadoCuentaMatrizPDF, exportEstadoCuentaInformePDF, exportEstadoCuentaMatrizExcel } from '../utils/exportEstadoCuenta';
import EstadoCuentaMatrizView from '../components/EstadoCuentaMatrizView';

// =============================================
// UTILIDADES DE EXPORTACIÓN GENERAL
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

const exportPDF = async (title, subtitle, columns, rows, filename) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();

  // Header Banner
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
  doc.text('LA CEIBA GROUP — GESTIÓN INMOBILIARIA', 28, 10);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 28, 16);


  // Subtitle + date
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(subtitle, 14, 28);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`, 220, 28);

  autoTable(doc, {
    startY: 32,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => row[c.key] ?? '—')),
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [22, 163, 74],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [246, 250, 246] },
    columnStyles: columns.reduce((acc, c, i) => {
      if (c.width) acc[i] = { cellWidth: c.width };
      if (c.align) acc[i] = { ...acc[i], halign: c.align };
      return acc;
    }, {}),
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, 250, doc.internal.pageSize.height - 5);
    doc.text('Confidencial — La Ceiba Gestión Inmobiliaria', 14, doc.internal.pageSize.height - 5);
  }

  doc.save(filename);
};

// =============================================
// COMPONENTE CARD DE REPORTE
// =============================================
function ReportCard({ icon: Icon, color, bg, title, desc, count, countLabel, onPDF, onExcel, loading: gen }) {
  return (
    <div className="card" style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
        <div style={{ width:46, height:46, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={20} color={color} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', marginBottom:4 }}>{title}</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.5 }}>{desc}</div>
        </div>
        {count !== undefined && (
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:24, fontWeight:800, color, lineHeight:1 }}>{count}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{countLabel}</div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:10, paddingTop:8, borderTop:'1px solid var(--border)' }}>
        <button
          className="btn btn-ghost"
          style={{ flex:1, fontSize:12, gap:6 }}
          onClick={onExcel}
          disabled={gen}
        >
          <FileSpreadsheet size={13} color="#16a34a" />
          Exportar Excel
        </button>
        <button
          className="btn btn-primary"
          style={{ flex:1, fontSize:12, gap:6 }}
          onClick={onPDF}
          disabled={gen}
        >
          <FileText size={13} />
          Exportar PDF
        </button>
      </div>
    </div>
  );
}

// =============================================
// PÁGINA REPORTES
// =============================================
export default function Reportes() {
  const [data, setData]               = useState({ ventas: [], lotes: [], clientes: [], cuotasMora: [] });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [generating, setGen]          = useState('');
  const [selectedVentaId, setSelectedVentaId] = useState('');
  const [searchFilter, setSearchFilter]       = useState('');

  const loadData = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const repData = await getReportesData(force);
      setData(repData);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const { ventas, lotes, cuotasMora } = data;
  const today = new Date().toISOString().slice(0, 10);

  // Cálculos y Consolidación
  const cuotasVencidas = cuotasMora.filter(c => c.estado_cuota === 'VENCIDA');
  const cuotasPorVencer = cuotasMora.filter(c => c.estado_cuota === 'POR VENCER');

  // Consolidación de Cartera en Mora por CLIENTE / LOTE (1 sola fila por contrato)
  const carteraMoraConsolidada = React.useMemo(() => {
    const map = {};
    cuotasMora.forEach(c => {
      if (!c.venta_id) return;
      if (!map[c.venta_id]) {
        map[c.venta_id] = {
          venta_id:         c.venta_id,
          id_lote:          c.ventas?.lotes?.id_lote ?? '—',
          cliente:          c.ventas?.clientes?.nombre ?? '—',
          celular:          c.ventas?.clientes?.celular ?? '—',
          vendedor:         c.ventas?.vendedor_nombre ?? '—',
          cuotasVencidas:   [],
          cuotasPorVencer:  [],
          totalValorVencido: 0,
          oldestVencidaDate: null,
          maxDiasMora:       0,
        };
      }

      const dias = diasDesdeHoy(c.fecha_vencimiento);
      if (c.estado_cuota === 'VENCIDA') {
        map[c.venta_id].cuotasVencidas.push(c.numero_cuota);
        map[c.venta_id].totalValorVencido += (c.valor_cuota || 0);
        if (!map[c.venta_id].oldestVencidaDate || c.fecha_vencimiento < map[c.venta_id].oldestVencidaDate) {
          map[c.venta_id].oldestVencidaDate = c.fecha_vencimiento;
          map[c.venta_id].maxDiasMora = dias ? Math.abs(dias) : 0;
        }
      } else if (c.estado_cuota === 'POR VENCER') {
        map[c.venta_id].cuotasPorVencer.push(c.numero_cuota);
      }
    });

    // Ordenar de mayor a menor días de atraso
    return Object.values(map)
      .filter(item => item.cuotasVencidas.length > 0)
      .sort((a, b) => b.maxDiasMora - a.maxDiasMora);
  }, [cuotasMora]);

  const uniqueClientesMora = carteraMoraConsolidada.length;

  const lotesPorEstado = {
    VENDIDO:       lotes.filter(l => l.estado === 'VENDIDO').length,
    DISPONIBLE:    lotes.filter(l => l.estado === 'DISPONIBLE').length,
    'EN NEGOCIACIÓN': lotes.filter(l => l.estado === 'EN NEGOCIACIÓN').length,
    APARTADO:      lotes.filter(l => l.estado === 'APARTADO').length,
  };
  const totalCartera   = ventas.reduce((a, v) => a + (v.saldo || 0), 0);
  const totalRecaudado = ventas.reduce((a, v) => a + (v.total_pagado_cliente || ((v.precio_venta || 0) - (v.saldo || 0))), 0);

  const [selectedVenta, setSelectedVenta]     = useState(null);
  const [selectedCuotas, setSelectedCuotas]   = useState([]);
  const [loadingCuotas, setLoadingCuotas]     = useState(false);

  const handleSelectVenta = async (ventaId) => {
    setSelectedVentaId(ventaId);
    if (!ventaId) {
      setSelectedVenta(null);
      setSelectedCuotas([]);
      return;
    }
    const venta = ventas.find(v => v.id === ventaId);
    setSelectedVenta(venta || null);
    setLoadingCuotas(true);
    try {
      const { data: cData } = await supabase
        .from('cuotas')
        .select('*')
        .eq('venta_id', ventaId)
        .order('numero_cuota', { ascending: true });
      setSelectedCuotas(cData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCuotas(false);
    }
  };


  // 1. Cartera General
  const generarCarteraExcel = async () => {
    setGen('cartera-excel');
    try {
      const rows = ventas.map(v => ({
        'ID Lote':           v.lotes?.id_lote ?? '—',
        'Cliente':           v.clientes?.nombre ?? v.cliente_nombre ?? '—',
        'Cédula':            v.clientes?.doc_cliente ?? '—',
        'Ciudad':            v.clientes?.ciudad ?? '—',
        'Celular':           v.clientes?.celular ?? '—',
        'Fecha Venta':       formatDate(v.fecha_venta),
        'Precio Venta':      v.precio_venta ?? 0,
        'Cuota Inicial':     v.valor_cuota_inicial ?? 0,
        'Saldo Financiado':  v.saldo_financiado ?? 0,
        'Plazo (Cuotas)':    v.plazo_cuotas ?? v.total_cuotas_plan ?? 0,
        'Valor Cuota':       v.valor_cuota ?? 0,
        'Días Pago':         v.dias_pago ?? '—',
        'Cuotas Pagadas ($)': v.cuotas_pagadas_monto ?? 0,
        '# Cuotas Pagadas':  v.cuotas_pagadas_count ?? 0,
        'Total Recaudado':   v.total_pagado_cliente ?? 0,
        'Saldo Pendiente':   v.saldo ?? 0,
        'Cuotas en Mora':    v.cuotas_vencidas_count ?? 0,
        'Vendedor':          v.vendedor_nombre ?? '—',
        'Comisión':          v.comision_vendedor ?? 0,
      }));
      await exportExcel([{ name: 'Cartera General', data: rows }], `cartera_general_laceiba_${today}.xlsx`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  const generarCarteraPDF = async () => {
    setGen('cartera-pdf');
    try {
      const rows = ventas.map(v => ({
        id_lote:   v.lotes?.id_lote ?? '—',
        cliente:   (v.clientes?.nombre ?? v.cliente_nombre ?? '—').slice(0, 30),
        celular:   v.clientes?.celular ?? '—',
        fecha_v:   formatDate(v.fecha_venta),
        precio:    formatCOP(v.precio_venta),
        cuota_i:   formatCOP(v.valor_cuota_inicial),
        saldo_fin: formatCOP(v.saldo_financiado),
        pagado_c:  formatCOP(v.cuotas_pagadas_monto),
        saldo:     formatCOP(v.saldo),
        mora:      v.cuotas_vencidas_count > 0 ? `${v.cuotas_vencidas_count} c.` : 'Al día',
        vendedor:  (v.vendedor_nombre ?? '—').slice(0, 16),
      }));
      await exportPDF(
        'REPORTE DE CARTERA GENERAL CONSOLIDADA',
        `${ventas.length} contratos · Saldo cartera: ${formatCOP(totalCartera)} · Total recaudado: ${formatCOP(totalRecaudado)}`,
        [
          { header: 'ID Lote',      key: 'id_lote',   width: 18 },
          { header: 'Cliente',      key: 'cliente',   width: 38 },
          { header: 'Celular',      key: 'celular',   width: 22 },
          { header: 'Fecha Venta',  key: 'fecha_v',   width: 20 },
          { header: 'Precio Venta', key: 'precio',    width: 26, align: 'right' },
          { header: 'Cuota Inicial',key: 'cuota_i',   width: 24, align: 'right' },
          { header: 'Saldo Financ.',key: 'saldo_fin', width: 26, align: 'right' },
          { header: 'Cuotas Pag.',  key: 'pagado_c',  width: 26, align: 'right' },
          { header: 'Saldo Pend.',  key: 'saldo',     width: 26, align: 'right' },
          { header: 'Mora',         key: 'mora',      width: 16, align: 'center' },
          { header: 'Vendedor',     key: 'vendedor',  width: 20 },
        ],
        rows,
        `cartera_laceiba_${today}.pdf`
      );
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  // 2. Cartera en Mora (Consolidado por Cliente / Contrato)
  const generarMoraExcel = async () => {
    setGen('mora-excel');
    try {
      const rows = carteraMoraConsolidada.map(c => {
        const v = ventas.find(vent => vent.id === c.venta_id);
        const cuotasList = c.cuotasVencidas.length > 1
          ? `${c.cuotasVencidas.length} cuotas (Cuotas ${c.cuotasVencidas[0]} a ${c.cuotasVencidas[c.cuotasVencidas.length - 1]})`
          : `Cuota ${c.cuotasVencidas[0]}`;

        return {
          'ID Lote':              c.id_lote,
          'Cliente':              c.cliente,
          'Cédula':               v?.clientes?.doc_cliente ?? '—',
          'Celular':              c.celular,
          'Cuotas en Mora':       cuotasList,
          'Total Valor en Mora':  c.totalValorVencido,
          'Saldo Deudor Total':   v?.saldo ?? 0,
          '1ra Cuota Vencida':    formatDate(c.oldestVencidaDate),
          'Días de Atraso':       c.maxDiasMora,
          'Meses de Atraso':      Math.floor(c.maxDiasMora / 30),
          'Asesor Comercial':     c.vendedor,
        };
      });
      await exportExcel([{ name: 'Cartera en Mora Consolidada', data: rows }], `cartera_mora_laceiba_${today}.xlsx`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  const generarMoraPDF = async () => {
    setGen('mora-pdf');
    try {
      const rows = carteraMoraConsolidada.map(c => {
        const v = ventas.find(vent => vent.id === c.venta_id);
        const meses = Math.floor(c.maxDiasMora / 30);
        const cuotasStr = c.cuotasVencidas.length > 1
          ? `${c.cuotasVencidas.length} (c.${c.cuotasVencidas[0]} a ${c.cuotasVencidas[c.cuotasVencidas.length - 1]})`
          : `Cuota ${c.cuotasVencidas[0]}`;

        return {
          id_lote:   c.id_lote,
          cliente:   c.cliente.slice(0, 30),
          celular:   c.celular,
          cuotas_v:  cuotasStr,
          fecha_1ra: formatDate(c.oldestVencidaDate),
          mora:      `${meses > 0 ? meses + 'm ' : ''}${c.maxDiasMora % 30}d`,
          valor_mora: formatCOP(c.totalValorVencido),
          saldo:     formatCOP(v?.saldo),
          vendedor:  c.vendedor.slice(0, 16),
        };
      });
      await exportPDF(
        'REPORTE DE CARTERA EN MORA (CONSOLIDADO POR CLIENTE)',
        `${carteraMoraConsolidada.length} contratos en mora · Total vencido consolidado para gestión de cobranzas`,
        [
          { header: 'ID Lote',          key: 'id_lote',    width: 18 },
          { header: 'Cliente',          key: 'cliente',    width: 40 },
          { header: 'Celular',          key: 'celular',    width: 24 },
          { header: 'Cuotas Mora',      key: 'cuotas_v',   width: 26, align: 'center' },
          { header: '1ra Vencida',      key: 'fecha_1ra',  width: 20 },
          { header: 'Atraso',           key: 'mora',       width: 16, align: 'center' },
          { header: 'Total en Mora',    key: 'valor_mora', width: 28, align: 'right' },
          { header: 'Saldo Total',      key: 'saldo',      width: 28, align: 'right' },
        ],
        rows,
        `mora_consolidada_laceiba_${today}.pdf`
      );
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  // 3. Inventario
  const generarInventarioExcel = async () => {
    setGen('inv-excel');
    try {
      const rows = lotes.map(l => ({
        'ID Lote':     l.id_lote,
        'Etapa':       l.etapa,
        'Manzana':     l.manzana,
        'Lote':        l.lote,
        'Área (m²)':   l.area_m2,
        'Precio Lote': l.precio_lote,
        'Estado':      l.estado,
        'Precio Venta':l.precio_venta,
        'Contrato':    l.contrato,
        'Escritura':   l.escritura,
        'Fecha Escritura': formatDate(l.fecha_escritura),
        '% Escriturado': l.porcentaje_escriturado,
        'Propietario': l.propietario,
        'Observación': l.observacion,
      }));
      await exportExcel([{ name: 'Inventario Lotes', data: rows }], `inventario_laceiba_${today}.xlsx`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  const generarInventarioPDF = async () => {
    setGen('inv-pdf');
    try {
      const rows = lotes.map(l => ({
        id_lote:  l.id_lote,
        etapa:    String(l.etapa ?? ''),
        manzana:  l.manzana ?? '—',
        lote:     l.lote ?? '—',
        area:     l.area_m2 ? `${parseFloat(l.area_m2).toFixed(0)} m²` : '—',
        precio:   formatCOP(l.precio_lote),
        estado:   l.estado ?? '—',
        contrato: l.contrato ?? '—',
      }));
      await exportPDF(
        'REPORTE DE INVENTARIO DE LOTES',
        `${lotes.length} lotes · Vendidos: ${lotesPorEstado.VENDIDO} · Disponibles: ${lotesPorEstado.DISPONIBLE}`,
        [
          { header: 'ID Lote',    key: 'id_lote', width: 22 },
          { header: 'Etapa',      key: 'etapa',   width: 12, align: 'center' },
          { header: 'Manzana',    key: 'manzana', width: 18, align: 'center' },
          { header: 'Lote',       key: 'lote',    width: 14, align: 'center' },
          { header: 'Área',       key: 'area',    width: 20, align: 'right' },
          { header: 'Precio Lote',key: 'precio',  width: 30, align: 'right' },
          { header: 'Estado',     key: 'estado',  width: 30 },
          { header: 'Contrato',   key: 'contrato',width: 20 },
        ],
        rows,
        `inventario_laceiba_${today}.pdf`
      );
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  // 4. Vendedores
  const generarVendedoresExcel = async () => {
    setGen('vend-excel');
    try {
      const map = {};
      ventas.forEach(v => {
        const k = v.vendedor_nombre || 'Sin asignar';
        if (!map[k]) map[k] = { vendedor: k, total_ventas: 0, valor_total: 0, comisiones: 0, saldo_pendiente: 0 };
        map[k].total_ventas++;
        map[k].valor_total    += v.precio_venta    || 0;
        map[k].comisiones     += v.comision_vendedor || 0;
        map[k].saldo_pendiente += v.saldo          || 0;
      });
      const rows = Object.values(map).sort((a, b) => b.total_ventas - a.total_ventas).map(r => ({
        'Vendedor':         r.vendedor,
        'Total Ventas':     r.total_ventas,
        'Valor Total':      r.valor_total,
        'Comisiones Total': r.comisiones,
        'Saldo Pendiente':  r.saldo_pendiente,
      }));
      await exportExcel([{ name: 'Ventas por Vendedor', data: rows }], `vendedores_laceiba_${today}.xlsx`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  const generarVendedoresPDF = async () => {
    setGen('vend-pdf');
    try {
      const map = {};
      ventas.forEach(v => {
        const k = v.vendedor_nombre || 'Sin asignar';
        if (!map[k]) map[k] = { vendedor: k, total: 0, valor: 0, comision: 0, saldo: 0 };
        map[k].total++;
        map[k].valor    += v.precio_venta || 0;
        map[k].comision += v.comision_vendedor || 0;
        map[k].saldo    += v.saldo || 0;
      });
      const rows = Object.values(map).sort((a, b) => b.total - a.total).map(r => ({
        vendedor: r.vendedor,
        total:    String(r.total),
        valor:    formatCOP(r.valor),
        comision: formatCOP(r.comision),
        saldo:    formatCOP(r.saldo),
      }));
      await exportPDF(
        'REPORTE DE VENTAS POR VENDEDOR',
        `${Object.keys(map).length} asesores · Total comisiones: ${formatCOP(ventas.reduce((a,v)=>a+(v.comision_vendedor||0),0))}`,
        [
          { header: 'Vendedor',         key: 'vendedor', width: 60 },
          { header: '# Ventas',         key: 'total',    width: 20, align: 'center' },
          { header: 'Valor Total',       key: 'valor',    width: 40, align: 'right' },
          { header: 'Comisiones',        key: 'comision', width: 35, align: 'right' },
          { header: 'Saldo Pendiente',   key: 'saldo',    width: 40, align: 'right' },
        ],
        rows,
        `vendedores_laceiba_${today}.pdf`
      );
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  const oldestVencidaByVentaId = {};
  cuotasVencidas.forEach(c => {
    if (c.venta_id && c.fecha_vencimiento) {
      if (!oldestVencidaByVentaId[c.venta_id] || c.fecha_vencimiento < oldestVencidaByVentaId[c.venta_id]) {
        oldestVencidaByVentaId[c.venta_id] = c.fecha_vencimiento;
      }
    }
  });

  // 5. Casos Críticos (Mora Real >= 180 días desde la primera cuota vencida)
  const casosCriticos = ventas.filter(v => {
    if ((v.saldo || 0) <= 0) return false;
    const oldestVenc = oldestVencidaByVentaId[v.id];
    if (!oldestVenc) return false;
    const dias = diasDesdeHoy(oldestVenc);
    return dias >= 180;
  });

  const generarCriticosExcel = async () => {
    setGen('criticos-excel');
    try {
      const rows = casosCriticos.map(v => {
        const oldestVenc = oldestVencidaByVentaId[v.id];
        const dias = diasDesdeHoy(oldestVenc);
        const valorCuota = v.valor_cuota || (v.saldo_financiado / (v.plazo_cuotas || 24));
        const cuotasPagadas = valorCuota > 0 ? Math.floor((v.abonos || 0) / valorCuota) : 0;
        const meses = Math.floor(dias / 30);
        return {
          'ID Lote':            v.lotes?.id_lote ?? '—',
          'Cliente':            v.clientes?.nombre ?? '—',
          'Cédula':             v.clientes?.doc_cliente ?? '—',
          'Celular':            v.clientes?.celular ?? '—',
          'Fecha Venta':        formatDate(v.fecha_venta),
          '1ra Cuota Vencida':  formatDate(oldestVenc),
          'Días de Mora Real':  dias,
          'Meses de Mora':      meses,
          'Cuota Inicial Pagada': v.valor_cuota_inicial ?? 0,
          'Cuotas Pagadas':     cuotasPagadas,
          'Cuota Mensual':      valorCuota,
          'Saldo Deudor Total': v.saldo ?? 0,
          'Asesor Comercial':   v.vendedor_nombre ?? '—',
        };
      });
      await exportExcel([{ name: 'Casos Críticos', data: rows }], `cartera_critica_laceiba_${today}.xlsx`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  const generarCriticosPDF = async () => {
    setGen('criticos-pdf');
    try {
      const rows = casosCriticos.map(v => {
        const oldestVenc = oldestVencidaByVentaId[v.id];
        const dias = diasDesdeHoy(oldestVenc);
        const valorCuota = v.valor_cuota || (v.saldo_financiado / (v.plazo_cuotas || 24));
        const cuotasPagadas = valorCuota > 0 ? Math.floor((v.abonos || 0) / valorCuota) : 0;
        return {
          id_lote:     v.lotes?.id_lote ?? '—',
          cliente:     (v.clientes?.nombre ?? '—').slice(0, 30),
          celular:     v.clientes?.celular ?? '—',
          vencida:     formatDate(oldestVenc),
          meses:       `${Math.floor(dias / 30)} meses`,
          pagadas:     `${cuotasPagadas} cuotas`,
          saldo:       formatCOP(v.saldo),
          vendedor:    (v.vendedor_nombre ?? '—').slice(0, 16),
        };
      });
      await exportPDF(
        'REPORTE DE CARTERA DE ALTO RIESGO (MORA REAL >= 180 DÍAS)',
        `${casosCriticos.length} contratos con más de 6 meses de atraso identificados para cobro jurídico`,
        [
          { header: 'ID Lote',          key: 'id_lote',     width: 18 },
          { header: 'Cliente',          key: 'cliente',     width: 42 },
          { header: 'Celular',          key: 'celular',     width: 24 },
          { header: '1ra Cuota Venc.',  key: 'vencida',     width: 22 },
          { header: 'Mora',             key: 'meses',       width: 18, align: 'center' },
          { header: 'Pagadas',          key: 'pagadas',     width: 18, align: 'center' },
          { header: 'Saldo Deudor',     key: 'saldo',       width: 30, align: 'right' },
          { header: 'Asesor',           key: 'vendedor',    width: 24 },
        ],
        rows,
        `casos_criticos_laceiba_${today}.pdf`
      );
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  // 6. Recaudos e Ingresos por Fecha de Pago
  const generarRecaudosExcel = async () => {
    setGen('recaudos-excel');
    try {
      const [cuotasRes, inicialesRes] = await Promise.all([
        supabase
          .from('cuotas')
          .select(`
            id, numero_cuota, fecha_vencimiento, fecha_pago, valor_cuota, valor_pagado, medio_pago, observacion,
            ventas ( vendedor_nombre, lotes (id_lote), clientes (nombre, doc_cliente, celular) )
          `)
          .not('fecha_pago', 'is', null)
          .order('fecha_pago', { ascending: false }),
        supabase
          .from('ventas')
          .select(`
            id, fecha_venta, valor_cuota_inicial, fecha_pago_cuota_inicial, medio_pago, vendedor_nombre,
            lotes (id_lote), clientes (nombre, doc_cliente, celular)
          `)
          .not('fecha_pago_cuota_inicial', 'is', null)
          .order('fecha_pago_cuota_inicial', { ascending: false })
      ]);

      const rowsC = (cuotasRes.data || [])
        .map(c => {
          const valor = c.valor_pagado !== null && c.valor_pagado !== undefined
            ? Number(c.valor_pagado)
            : (Number(c.valor_cuota) || 0);
          return {
            'Fecha de Pago': formatDate(c.fecha_pago),
            'Tipo Ingreso': 'Cuota Mensual',
            'ID Lote': c.ventas?.lotes?.id_lote || '—',
            'Cliente': c.ventas?.clientes?.nombre || '—',
            'Cédula': c.ventas?.clientes?.doc_cliente || '—',
            'Celular': c.ventas?.clientes?.celular || '—',
            'Concepto': `Cuota #${c.numero_cuota}`,
            'Fecha Vencimiento': formatDate(c.fecha_vencimiento),
            'Valor Pagado': valor,
            'Medio de Pago': c.medio_pago || '—',
            'Asesor': c.ventas?.vendedor_nombre || 'Sin Asesor',
            'Observación': c.observacion || ''
          };
        })
        .filter(r => r['Valor Pagado'] > 0);

      const rowsI = (inicialesRes.data || [])
        .map(v => ({
          'Fecha de Pago': formatDate(v.fecha_pago_cuota_inicial),
          'Tipo Ingreso': 'Cuota Inicial',
          'ID Lote': v.lotes?.id_lote || '—',
          'Cliente': v.clientes?.nombre || '—',
          'Cédula': v.clientes?.doc_cliente || '—',
          'Celular': v.clientes?.celular || '—',
          'Concepto': 'Cuota Inicial',
          'Fecha Vencimiento': formatDate(v.fecha_venta || v.fecha_pago_cuota_inicial),
          'Valor Pagado': Number(v.valor_cuota_inicial) || 0,
          'Medio de Pago': v.medio_pago || '—',
          'Asesor': v.vendedor_nombre || 'Sin Asesor',
          'Observación': 'Venta lote'
        }))
        .filter(r => r['Valor Pagado'] > 0);

      const allRows = [...rowsC, ...rowsI].sort((a, b) => (b['Fecha de Pago'] || '').localeCompare(a['Fecha de Pago'] || ''));

      await exportExcel([
        { name: 'Todos los Recaudos', data: allRows },
        { name: 'Cuotas Mensuales', data: rowsC },
        { name: 'Cuotas Iniciales', data: rowsI }
      ], `recaudos_ingresos_por_fecha_pago_${today}.xlsx`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };

  const generarRecaudosPDF = async () => {
    setGen('recaudos-pdf');
    try {
      const [cuotasRes, inicialesRes] = await Promise.all([
        supabase
          .from('cuotas')
          .select(`
            id, numero_cuota, fecha_vencimiento, fecha_pago, valor_cuota, valor_pagado, medio_pago,
            ventas ( vendedor_nombre, lotes (id_lote), clientes (nombre, doc_cliente) )
          `)
          .not('fecha_pago', 'is', null)
          .order('fecha_pago', { ascending: false }),
        supabase
          .from('ventas')
          .select(`
            id, fecha_venta, valor_cuota_inicial, fecha_pago_cuota_inicial, medio_pago, vendedor_nombre,
            lotes (id_lote), clientes (nombre, doc_cliente)
          `)
          .not('fecha_pago_cuota_inicial', 'is', null)
          .order('fecha_pago_cuota_inicial', { ascending: false })
      ]);

      const itemsC = (cuotasRes.data || [])
        .map(c => {
          const val = c.valor_pagado !== null && c.valor_pagado !== undefined
            ? Number(c.valor_pagado)
            : (Number(c.valor_cuota) || 0);
          return {
            fecha_pago: formatDate(c.fecha_pago),
            raw_f: c.fecha_pago,
            lote: c.ventas?.lotes?.id_lote || '—',
            cliente: (c.ventas?.clientes?.nombre || '—').slice(0, 26),
            concepto: `Cuota #${c.numero_cuota}`,
            venc: formatDate(c.fecha_vencimiento),
            valor: formatCOP(val),
            raw_val: val,
            medio: (c.medio_pago || '—').slice(0, 16),
            vendedor: (c.ventas?.vendedor_nombre || 'Sin Asesor').slice(0, 16)
          };
        })
        .filter(it => it.raw_val > 0);

      const itemsI = (inicialesRes.data || [])
        .map(v => {
          const val = Number(v.valor_cuota_inicial) || 0;
          return {
            fecha_pago: formatDate(v.fecha_pago_cuota_inicial),
            raw_f: v.fecha_pago_cuota_inicial,
            lote: v.lotes?.id_lote || '—',
            cliente: (v.clientes?.nombre || '—').slice(0, 26),
            concepto: 'Cuota Inicial',
            venc: formatDate(v.fecha_venta || v.fecha_pago_cuota_inicial),
            valor: formatCOP(val),
            raw_val: val,
            medio: (v.medio_pago || '—').slice(0, 16),
            vendedor: (v.vendedor_nombre || 'Sin Asesor').slice(0, 16)
          };
        })
        .filter(it => it.raw_val > 0);

      const allItems = [...itemsC, ...itemsI].sort((a, b) => (b.raw_f || '').localeCompare(a.raw_f || ''));
      const totalSum = allItems.reduce((s, it) => s + it.raw_val, 0);

      await exportPDF(
        'REPORTE HISTÓRICO DE RECAUDOS E INGRESOS POR FECHA DE PAGO',
        `${allItems.length} transacciones registradas · Total Recaudado: ${formatCOP(totalSum)}`,
        [
          { header: 'Fecha Pago',   key: 'fecha_pago', width: 22, align: 'center' },
          { header: 'ID Lote',      key: 'lote',       width: 22, align: 'center' },
          { header: 'Cliente',      key: 'cliente',    width: 44 },
          { header: 'Concepto',     key: 'concepto',   width: 26, align: 'center' },
          { header: 'Fecha Venc.',  key: 'venc',       width: 22, align: 'center' },
          { header: 'Valor Pagado', key: 'valor',      width: 28, align: 'right' },
          { header: 'Medio Pago',   key: 'medio',      width: 26 },
          { header: 'Asesor',       key: 'vendedor',   width: 28 },
        ],
        allItems,
        `recaudos_historicos_laceiba_${today}.pdf`
      );
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGen('');
    }
  };


  const filteredVentasForSelect = ventas.filter(v => {
    if (!searchFilter) return true;
    const s = searchFilter.toLowerCase();
    return (
      v.lotes?.id_lote?.toLowerCase().includes(s) ||
      v.clientes?.nombre?.toLowerCase().includes(s) ||
      v.clientes?.doc_cliente?.toLowerCase().includes(s)
    );
  });

  const isGen = !!generating;

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', gap:12, color:'var(--text-muted)' }}>
      <RefreshCw size={20} style={{ animation:'spin 1s linear infinite' }} />
      Cargando datos para reportes...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div className="alert-banner red" style={{ margin: 20 }}>
      <AlertTriangle size={16} /> Error cargando datos: {error}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reportes</div>
          <div className="page-subtitle">Exporta información en PDF o Excel con datos en tiempo real</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isGen && (
            <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--accent)', fontSize:13, fontWeight:600 }}>
              <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} />
              Generando reporte...
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => loadData(true)}
            title="Actualizar datos desde la base de datos"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 12px' }}
          >
            <RotateCw size={13} />
            Actualizar Datos
          </button>
        </div>
      </div>

      {/* GENERADOR RÁPIDO DE ESTADO DE CUENTA INDIVIDUAL (Para la Contadora / Clientes) */}
      <div className="card" style={{ marginBottom: 28, background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', border: '1px solid #bbf7d0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={22} color="#16a34a" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              📄 Generador de Estado de Cuenta Individual (Cliente / Lote)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Genera e imprime el extracto financiero oficial con 1 clic para entrega inmediata al cliente o revisión contable.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="search-input"
              style={{ paddingLeft: 36, width: '100%', background: '#fff' }}
              placeholder="Filtrar por lote o nombre de cliente..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            style={{ flex: 1.5, minWidth: 280, background: '#fff' }}
            value={selectedVentaId}
            onChange={e => handleSelectVenta(e.target.value)}
          >
            <option value="">-- Selecciona un Cliente / Lote ({filteredVentasForSelect.length} lotes disponibles) --</option>
            {filteredVentasForSelect.map(v => (
              <option key={v.id} value={v.id}>
                {v.lotes?.id_lote || v.id_lote || 'Sin lote'} — {v.clientes?.nombre || v.cliente_nombre || 'Sin cliente'} (Saldo: {formatCOP(v.saldo)})
              </option>
            ))}
          </select>
        </div>

        {/* Vista interactiva del Estado de Cuenta (Exacto a la imagen) */}
        {selectedVenta && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #bbf7d0' }}>
            {loadingCuotas ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Cargando estado de cuenta del cliente...
              </div>
            ) : (
              <EstadoCuentaMatrizView venta={selectedVenta} cuotas={selectedCuotas} />
            )}
          </div>
        )}
      </div>

      {/* KPIs rápidos */}
      <div className="kpi-grid" style={{ marginBottom:28 }}>
        {[
          { label:'Total Lotes',          val: lotes.length,              icon: Building2,    color:'blue' },
          { label:'Ventas Registradas',   val: ventas.length,             icon: TrendingUp,   color:'green' },
          { label:'Clientes en Mora',     val: uniqueClientesMora,        icon: AlertTriangle,color:'red' },
          { label:'Casos Críticos (>180d)', val: casosCriticos.length,   icon: AlertTriangle,color:'red' },
          { label:'Cartera Pendiente',    val: formatCOP(totalCartera),   icon: FileText,     color:'yellow' },
          { label:'Total Recaudado',      val: formatCOP(totalRecaudado), icon: CheckCircle2, color:'green' },
        ].map(k => (
          <div key={k.label} className={`kpi-card ${k.color}`}>
            <div className={`kpi-icon ${k.color}`}><k.icon size={18} /></div>
            <div className="kpi-value" style={{ fontSize: String(k.val).length > 10 ? 18 : 26 }}>{k.val}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Grid de reportes generales */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(380px,1fr))', gap:20 }}>
        <ReportCard
          icon={DollarSign}
          color="#16a34a" bg="#dcfce7"
          title="Recaudos por Fecha de Pago"
          desc="Libro contable de todos los ingresos de dinero recibidos (cuotas mensuales e iniciales) ordenados cronológicamente por la fecha real en que el cliente pagó."
          count={ventas.reduce((a, v) => a + (v.cuotas_pagadas_count || 0), 0) + ventas.filter(v => v.fecha_pago_cuota_inicial).length} countLabel="pagos recibidos"
          onExcel={generarRecaudosExcel}
          onPDF={generarRecaudosPDF}
          loading={isGen}
        />

        <ReportCard
          icon={TrendingUp}
          color="#2563eb" bg="#dbeafe"
          title="Cartera General"
          desc="Todas las ventas con saldos, cuotas, clientes y vendedores. Vista completa del estado financiero del proyecto."
          count={ventas.length} countLabel="contratos"
          onExcel={generarCarteraExcel}
          onPDF={generarCarteraPDF}
          loading={isGen}
        />

        <ReportCard
          icon={AlertTriangle}
          color="#dc2626" bg="#fee2e2"
          title="Cartera en Mora"
          desc="Cuotas vencidas y por vencer con desglose y datos de contacto de clientes para gestión regular de cobro."
          count={uniqueClientesMora} countLabel="contratos en mora"
          onExcel={generarMoraExcel}
          onPDF={generarMoraPDF}
          loading={isGen}
        />

        <ReportCard
          icon={AlertTriangle}
          color="#991b1b" bg="#ffe4e6"
          title="🚨 Casos Críticos (>180 días mora)"
          desc="Contratos de alto riesgo: clientes que dieron cuota inicial (o 1-2 cuotas) y llevan de 6 meses a 2 años sin pagar."
          count={casosCriticos.length} countLabel="casos de alto riesgo"
          onExcel={generarCriticosExcel}
          onPDF={generarCriticosPDF}
          loading={isGen}
        />

        <ReportCard
          icon={Building2}
          color="#2563eb" bg="#dbeafe"
          title="Inventario de Lotes"
          desc={`Estado completo del inventario: ${lotesPorEstado.VENDIDO} vendidos, ${lotesPorEstado.DISPONIBLE} disponibles, ${lotesPorEstado['EN NEGOCIACIÓN'] || 0} en negociación, ${lotesPorEstado.APARTADO || 0} apartados.`}
          count={lotes.length} countLabel="lotes"
          onExcel={generarInventarioExcel}
          onPDF={generarInventarioPDF}
          loading={isGen}
        />

        <ReportCard
          icon={Users}
          color="#7c3aed" bg="#ede9fe"
          title="Ventas por Vendedor"
          desc="Resumen de desempeño por asesor: número de ventas, valor total vendido, comisiones generadas y saldo pendiente de cobro."
          count={[...new Set(ventas.map(v => v.vendedor_nombre).filter(Boolean))].length} countLabel="asesores"
          onExcel={generarVendedoresExcel}
          onPDF={generarVendedoresPDF}
          loading={isGen}
        />
      </div>


      <div style={{ marginTop:24, padding:16, background:'#f6faf6', borderRadius:12, border:'1px solid var(--border)', fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:10 }}>
        <CheckCircle2 size={14} color="var(--accent)" />
        Todos los reportes usan datos en tiempo real desde la base de datos. Los archivos se descargan directamente a tu computador.
      </div>
    </div>
  );
}
