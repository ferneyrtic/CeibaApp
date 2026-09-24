import { formatCOP, formatDate } from './helpers';

/**
 * Carga el logo oficial desde /logo.png en formato base64 para jsPDF
 */
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
    console.warn('No se pudo cargar el logo para PDF:', e);
    return null;
  }
};

/**
 * Resuelve el estado visual inteligente de una cuota
 */
export const resolveCuotaDisplay = (cuota, numCuota, plazoTotal) => {
  if (numCuota > plazoTotal || (!cuota && numCuota > (plazoTotal || 24))) {
    return {
      num: numCuota <= (plazoTotal || 0) ? `CUOTA ${numCuota}` : '—',
      fecha: '—',
      fechaPago: null,
      fechaVenc: null,
      estado: '—',
      valor: '—',
      color: [203, 213, 225],
      cssColor: '#cbd5e1',
      isExceeded: true,
    };
  }

  const valor = cuota?.valor_cuota ? formatCOP(cuota.valor_cuota) : '—';
  const fechaVenc = cuota?.fecha_vencimiento ? formatDate(cuota.fecha_vencimiento) : '—';
  const fechaPago = cuota?.fecha_pago ? formatDate(cuota.fecha_pago) : null;

  // 1. Si está pagada
  if (cuota?.estado_cuota === 'PAGA' || (cuota?.valor_pagado && cuota.valor_pagado > 0)) {
    return {
      num: `CUOTA ${numCuota}`,
      fecha: fechaPago || fechaVenc,
      fechaPago,
      fechaVenc,
      estado: 'PAGA',
      valor: cuota?.valor_pagado ? formatCOP(cuota.valor_pagado) : valor,
      color: [22, 163, 74],
      cssColor: '#16a34a',
      fontStyle: 'bold',
      isExceeded: false,
    };
  }

  // 2. Si tiene fecha de vencimiento, evaluar si es actual, vencida o futura
  if (cuota?.fecha_vencimiento) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fv = new Date(cuota.fecha_vencimiento + 'T12:00:00');
    const diffDays = Math.round((fv - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || cuota.estado_cuota === 'VENCIDA') {
      return {
        num: `CUOTA ${numCuota}`,
        fecha: fechaVenc,
        fechaPago: null,
        fechaVenc,
        estado: 'VENCIDA',
        valor,
        color: [220, 38, 38],
        cssColor: '#dc2626',
        fontStyle: 'bold',
        isExceeded: false,
      };
    }

    if (diffDays <= 7 || cuota.estado_cuota === 'POR VENCER') {
      return {
        num: `CUOTA ${numCuota}`,
        fecha: fechaVenc,
        fechaPago: null,
        fechaVenc,
        estado: 'POR VENCER',
        valor,
        color: [217, 119, 6],
        cssColor: '#d97706',
        fontStyle: 'bold',
        isExceeded: false,
      };
    }

    if (diffDays <= 30) {
      return {
        num: `CUOTA ${numCuota}`,
        fecha: fechaVenc,
        fechaPago: null,
        fechaVenc,
        estado: 'AL DÍA',
        valor,
        color: [37, 99, 235],
        cssColor: '#2563eb',
        fontStyle: 'normal',
        isExceeded: false,
      };
    }

    return {
      num: `CUOTA ${numCuota}`,
      fecha: fechaVenc,
      fechaPago: null,
      fechaVenc,
      estado: 'PROGRAMADA',
      valor,
      color: [148, 163, 184],
      cssColor: '#94a3b8',
      fontStyle: 'normal',
      isExceeded: false,
    };
  }

  return {
    num: `CUOTA ${numCuota}`,
    fecha: '—',
    fechaPago: null,
    fechaVenc: null,
    estado: 'PROGRAMADA',
    valor,
    color: [148, 163, 184],
    cssColor: '#94a3b8',
    fontStyle: 'normal',
    isExceeded: false,
  };
};

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * OPCIÓN 1: FORMATO TABLA / MATRIZ EXCEL (Con Logo y Encabezados Corregidos)
 * ══════════════════════════════════════════════════════════════════════════════
 */
export const exportEstadoCuentaMatrizPDF = async (venta, cuotas = []) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();

  const loteId = venta.lotes?.id_lote || venta.id_lote || '—';
  const docCliente = venta.clientes?.doc_cliente || '—';
  const nombreCliente = venta.clientes?.nombre || '—';
  const cuotaInicial = venta.valor_cuota_inicial ?? 0;
  const saldoFinanciado = venta.saldo_financiado ?? 0;
  const plazoTotal = venta.plazo_cuotas || cuotas.length || 0;
  const plazo = plazoTotal ? `${plazoTotal}` : '—';
  const valorCuota = venta.valor_cuota ?? 0;

  // Suma exacta de cuotas pagadas (idéntico a G27 en el formato Excel de la secretaria)
  const totalCuotasPagadas = cuotas
    .filter(c => c.estado_cuota === 'PAGA' || (c.valor_pagado && c.valor_pagado > 0))
    .reduce((acc, c) => acc + (Number(c.valor_pagado) || 0), 0);

  // Saldo pendiente exacto (Saldo Financiado - Cuotas Pagadas, idéntico a K27 en Excel)
  const saldoActual = saldoFinanciado > 0
    ? Math.max(0, saldoFinanciado - totalCuotasPagadas)
    : Math.max(0, (venta.precio_venta ?? 0) - cuotaInicial - totalCuotasPagadas);

  const totalPrecio = venta.precio_venta ?? 0;
  const totalPagado = totalCuotasPagadas;
  const totalRecaudadoGlobal = cuotaInicial + totalCuotasPagadas;

  const VERDE_HEADER = [77, 142, 59]; // #4d8e3b
  const BORDE_GRID = [180, 180, 180];

  // 1. LOGO EN LA ESQUINA SUPERIOR IZQUIERDA
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'JPEG', 14, 5, 12, 17);
    } catch (e) {
      console.warn('Error embedding logo:', e);
    }
  }

  // 2. TÍTULOS SUPERIORES (CORREGIDO: LA CEIBA GROUP)
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LA CEIBA GROUP — PROYECTO CAMPESTRE', 148, 11, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('ESTADO DE CUENTA CLIENTES', 148, 17, { align: 'center' });

  // 3. TABLA 1: INFORMACIÓN GENERAL DEL CLIENTE / LOTE
  const infoHead = [['ID LOTE', '# DOC CLIENTE', 'NOMBRE Y APELLIDOS', 'VALOR CUOTA INICIAL', 'SALDO FINANCIADO', 'PLAZO/CUOTAS', 'VALOR CUOTA']];
  const infoBody = [[
    loteId,
    docCliente,
    nombreCliente,
    formatCOP(cuotaInicial),
    formatCOP(saldoFinanciado),
    plazo,
    formatCOP(valorCuota)
  ]];

  autoTable(doc, {
    startY: 23,
    head: infoHead,
    body: infoBody,
    theme: 'grid',
    headStyles: {
      fillColor: VERDE_HEADER,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      halign: 'center',
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: BORDE_GRID,
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 32 },
      2: { cellWidth: 70, halign: 'left' },
      3: { cellWidth: 36, halign: 'right' },
      4: { cellWidth: 36, halign: 'right' },
      5: { cellWidth: 30, halign: 'center' },
      6: { cellWidth: 37, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // 4. TABLA 2: MATRIZ DE CUOTAS EN 3 COLUMNAS
  const cuotasStartY = doc.lastAutoTable.finalY + 5;

  // Banner "ESTADO DE CUOTAS"
  doc.setFillColor(...VERDE_HEADER);
  doc.rect(14, cuotasStartY, 269, 6.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ESTADO DE CUOTAS', 148, cuotasStartY + 4.5, { align: 'center' });

  const ROWS_COUNT = 12;
  const matrixRows = [];

  for (let r = 0; r < ROWS_COUNT; r++) {
    const c1 = cuotas.find(c => c.numero_cuota === r + 1);
    const d1 = resolveCuotaDisplay(c1, r + 1, plazoTotal);

    const c2 = cuotas.find(c => c.numero_cuota === r + 13);
    const d2 = resolveCuotaDisplay(c2, r + 13, plazoTotal);

    const c3 = cuotas.find(c => c.numero_cuota === r + 25);
    const d3 = resolveCuotaDisplay(c3, r + 25, plazoTotal);

    matrixRows.push([
      d1.num, d1.fecha, d1.estado, d1.valor,
      d2.num, d2.fecha, d2.estado, d2.valor,
      d3.num, d3.fecha, d3.estado, d3.valor
    ]);
  }

  const cuotasHead = [[
    '# DE CUOTA', 'FECHA PAGO / VENC.', 'ESTADO CUOTA', 'VALOR',
    '# DE CUOTA', 'FECHA PAGO / VENC.', 'ESTADO CUOTA', 'VALOR',
    '# DE CUOTA', 'FECHA PAGO / VENC.', 'ESTADO CUOTA', 'VALOR'
  ]];

  autoTable(doc, {
    startY: cuotasStartY + 6.5,
    head: cuotasHead,
    body: matrixRows,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 245, 240],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6.5,
      cellPadding: 1.5,
      lineColor: BORDE_GRID,
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 6.5,
      cellPadding: 1.6,
      textColor: [30, 41, 59],
      lineColor: BORDE_GRID,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 23 },

      4: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 26 },
      6: { halign: 'center', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 23 },

      8: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
      9: { halign: 'center', cellWidth: 26 },
      10: { halign: 'center', cellWidth: 22 },
      11: { halign: 'right', cellWidth: 25 },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && (data.column.index === 2 || data.column.index === 6 || data.column.index === 10)) {
        const val = data.cell.raw;
        if (val === 'PAGA') {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'VENCIDA') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'POR VENCER') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'AL DÍA') {
          data.cell.styles.textColor = [37, 99, 235];
        } else if (val === 'PROGRAMADA') {
          data.cell.styles.textColor = [148, 163, 184];
        } else {
          data.cell.styles.textColor = [203, 213, 225];
        }
      }
    }
  });

  // 5. TABLA 3: CAJA DE TOTAL PAGADO Y SALDO
  const totalsStartY = doc.lastAutoTable.finalY + 5;
  const totalsHead = [['TOTAL PAGADO', 'SALDO PENDIENTE']];
  const totalsBody = [[formatCOP(totalPagado), formatCOP(saldoActual)]];

  autoTable(doc, {
    startY: totalsStartY,
    head: totalsHead,
    body: totalsBody,
    theme: 'grid',
    headStyles: {
      fillColor: VERDE_HEADER,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
      cellPadding: 2,
    },
    bodyStyles: {
      halign: 'center',
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: BORDE_GRID,
    },
    margin: { left: 95, right: 95 },
  });

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`La Ceiba Gestión Inmobiliaria · Generado: ${new Date().toLocaleDateString('es-CO')}`, 14, doc.internal.pageSize.height - 5);
  doc.text(`ID Lote: ${loteId}`, 260, doc.internal.pageSize.height - 5);

  const safeFilename = `Estado_Cuenta_Matriz_${loteId.replace(/\s+/g, '_')}.pdf`;
  doc.save(safeFilename);
};

/**
 * Exporta el Estado de Cuenta en Excel estructurado limpiamente
 */
export const exportEstadoCuentaMatrizExcel = async (venta, cuotas = []) => {
  const XLSX = await import('xlsx');

  const loteId = venta.lotes?.id_lote || venta.id_lote || '—';
  const docCliente = venta.clientes?.doc_cliente || '—';
  const nombreCliente = venta.clientes?.nombre || '—';
  const cuotaInicial = venta.valor_cuota_inicial ?? 0;
  const saldoFinanciado = venta.saldo_financiado ?? 0;
  const plazoTotal = venta.plazo_cuotas || cuotas.length || 0;
  const valorCuota = venta.valor_cuota ?? 0;

  const totalCuotasPagadas = cuotas
    .filter(c => c.estado_cuota === 'PAGA' || (c.valor_pagado && c.valor_pagado > 0))
    .reduce((acc, c) => acc + (Number(c.valor_pagado) || 0), 0);

  const saldoActual = saldoFinanciado > 0
    ? Math.max(0, saldoFinanciado - totalCuotasPagadas)
    : Math.max(0, (venta.precio_venta ?? 0) - cuotaInicial - totalCuotasPagadas);

  const totalPrecio = venta.precio_venta ?? 0;
  const totalPagado = totalCuotasPagadas;
  const totalRecaudadoGlobal = cuotaInicial + totalCuotasPagadas;

  const wsData = [
    ['', '', 'LA CEIBA GROUP — PROYECTO CAMPESTRE'],
    [],
    ['', '', 'ESTADO DE CUENTA CLIENTES'],
    [],
    ['ID LOTE', '# DOC CLIENTE', 'NOMBRE Y APELLIDOS', 'VALOR CUOTA INICIAL', 'SALDO FINANCIADO', 'PLAZO/CUOTAS', 'VALOR CUOTA'],
    [loteId, docCliente, nombreCliente, cuotaInicial, saldoFinanciado, plazoTotal, valorCuota],
    [],
    ['', '', '', '', '', 'ESTADO DE CUOTAS'],
    [
      '# DE CUOTA', 'FECHA PAGO / VENC.', 'ESTADO CUOTA', 'VALOR',
      '# DE CUOTA', 'FECHA PAGO / VENC.', 'ESTADO CUOTA', 'VALOR',
      '# DE CUOTA', 'FECHA PAGO / VENC.', 'ESTADO CUOTA', 'VALOR'
    ],
  ];

  for (let r = 0; r < 12; r++) {
    const c1 = cuotas.find(c => c.numero_cuota === r + 1);
    const d1 = resolveCuotaDisplay(c1, r + 1, plazoTotal);

    const c2 = cuotas.find(c => c.numero_cuota === r + 13);
    const d2 = resolveCuotaDisplay(c2, r + 13, plazoTotal);

    const c3 = cuotas.find(c => c.numero_cuota === r + 25);
    const d3 = resolveCuotaDisplay(c3, r + 25, plazoTotal);

    wsData.push([
      d1.num, d1.fecha, d1.estado, d1.isExceeded ? '' : c1?.valor_cuota ?? '',
      d2.num, d2.fecha, d2.estado, d2.isExceeded ? '' : c2?.valor_cuota ?? '',
      d3.num, d3.fecha, d3.estado, d3.isExceeded ? '' : c3?.valor_cuota ?? ''
    ]);
  }

  wsData.push([]);
  wsData.push(['', '', '', '', 'TOTAL PAGADO', '', '', '', 'SALDO']);
  wsData.push(['', '', '', '', totalPagado, '', '', '', saldoActual]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'ESTADO DE CUENTA');
  XLSX.writeFile(wb, `Estado_Cuenta_${loteId.replace(/\s+/g, '_')}.xlsx`);
};

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * OPCIÓN 2: FORMATO INFORME EJECUTIVO (Con Logo Oficial en Esquina y Firmas)
 * ══════════════════════════════════════════════════════════════════════════════
 */
export const exportEstadoCuentaInformePDF = async (venta, cuotas = []) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoBase64 = await getLogoBase64();
  const todayStr = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Header Banner
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, 210, 25, 'F');

  // Logo en la esquina superior izquierda
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'JPEG', 10, 3, 13, 19);
    } catch (e) {
      console.warn('Error embedding logo:', e);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LA CEIBA GROUP — PROYECTO CAMPESTRE', 28, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('INFORME EJECUTIVO DE ESTADO DE CUENTA', 28, 18);
  doc.text(`Fecha: ${todayStr}`, 155, 18);

  const clienteNombre = venta.clientes?.nombre || 'Sin cliente asignado';
  const clienteDoc = venta.clientes?.doc_cliente ? `CC ${venta.clientes.doc_cliente}` : '—';
  const loteId = venta.lotes?.id_lote || venta.id_lote || '—';
  const totalPrecio     = Number(venta.precio_venta) || 0;
  const saldoFinanciado = Number(venta.saldo_financiado) || 0;
  const cuotaInicial    = Number(venta.valor_cuota_inicial) || 0;

  const totalCuotasPagadas = cuotas
    .filter(c => c.estado_cuota === 'PAGA' || (c.valor_pagado && c.valor_pagado > 0))
    .reduce((acc, c) => acc + (Number(c.valor_pagado) || 0), 0);

  const saldoActual = saldoFinanciado > 0
    ? Math.max(0, saldoFinanciado - totalCuotasPagadas)
    : Math.max(0, totalPrecio - cuotaInicial - totalCuotasPagadas);

  const totalPagado = totalCuotasPagadas;
  const totalRecaudadoGlobal = cuotaInicial + totalCuotasPagadas;

  const infoTable = [
    [
      { content: 'CLIENTE:', fontStyle: 'bold', styles: { textColor: [100, 116, 139] } },
      clienteNombre,
      { content: 'INMUEBLE:', fontStyle: 'bold', styles: { textColor: [100, 116, 139] } },
      loteId
    ],
    [
      { content: 'DOCUMENTO:', fontStyle: 'bold', styles: { textColor: [100, 116, 139] } },
      clienteDoc,
      { content: 'FECHA VENTA:', fontStyle: 'bold', styles: { textColor: [100, 116, 139] } },
      formatDate(venta.fecha_venta)
    ],
    [
      { content: 'PRECIO TOTAL:', fontStyle: 'bold', styles: { textColor: [100, 116, 139] } },
      formatCOP(totalPrecio),
      { content: 'CUOTA INICIAL:', fontStyle: 'bold', styles: { textColor: [100, 116, 139] } },
      formatCOP(venta.valor_cuota_inicial)
    ],
    [
      { content: 'SALDO FINANCIADO:', fontStyle: 'bold', styles: { textColor: [100, 116, 139] } },
      formatCOP(venta.saldo_financiado),
      { content: 'PLAN DE PAGOS:', fontStyle: 'bold', styles: { textColor: [100, 116, 139] } },
      `${venta.plazo_cuotas || '—'} cuotas de ${formatCOP(venta.valor_cuota)}`
    ],
    [
      { content: 'TOTAL PAGADO (CUOTAS):', fontStyle: 'bold', styles: { textColor: [22, 163, 74] } },
      { content: formatCOP(totalCuotasPagadas), fontStyle: 'bold', styles: { textColor: [22, 163, 74] } },
      { content: 'SALDO PENDIENTE:', fontStyle: 'bold', styles: { textColor: [180, 83, 9] } },
      { content: formatCOP(saldoActual), fontStyle: 'bold', styles: { textColor: [180, 83, 9] } }
    ],
  ];

  autoTable(doc, {
    startY: 31,
    body: infoTable,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 36, fillColor: [248, 250, 252] },
      1: { cellWidth: 58 },
      2: { cellWidth: 36, fillColor: [248, 250, 252] },
      3: { cellWidth: 52 },
    },
    margin: { left: 14, right: 14 },
  });

  const plazoTotal = venta.plazo_cuotas || cuotas.length || 0;
  const cuotasRows = (cuotas || []).map(c => {
    const d = resolveCuotaDisplay(c, c.numero_cuota, plazoTotal);
    return [
      `#${c.numero_cuota}`,
      formatDate(c.fecha_vencimiento),
      formatCOP(c.valor_cuota),
      d.estado,
      formatDate(c.fecha_pago),
      c.valor_pagado ? formatCOP(c.valor_pagado) : '—',
      c.medio_pago || '—'
    ];
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['# Cuota', 'Fecha Venc.', 'Valor Cuota', 'Estado', 'Fecha Pago', 'Valor Pagado', 'Medio Pago']],
    body: cuotasRows.length > 0 ? cuotasRows : [['—', '—', '—', 'Sin cuotas', '—', '—', '—']],
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [30, 41, 59] },
    headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  const finalY = Math.min(doc.lastAutoTable.finalY + 18, doc.internal.pageSize.height - 25);
  doc.setDrawColor(148, 163, 184);
  doc.line(20, finalY, 80, finalY);
  doc.line(130, finalY, 190, finalY);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Revisado por (Contabilidad / Cartera)', 22, finalY + 4);
  doc.text('Recibido por (Cliente / Titular)', 135, finalY + 4);

  const safeFilename = `Informe_Estado_Cuenta_${loteId.replace(/\s+/g, '_')}.pdf`;
  doc.save(safeFilename);
};

export const exportEstadoCuentaPDF = exportEstadoCuentaMatrizPDF;
