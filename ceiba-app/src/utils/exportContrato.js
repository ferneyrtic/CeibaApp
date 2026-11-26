import jsPDF from 'jspdf';
import { formatCOP, formatDate } from './helpers';
import { numeroALetrasCOP } from './numeroALetras';

/**
 * Formatea una cédula colombiana con puntos de mil si es numérica
 */
function formatCedula(doc) {
  const clean = String(doc || '').replace(/[^\d]/g, '');
  if (!clean) return String(doc || 'PENDIENTE');
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatea fecha en español largo: "16 de julio del 2026"
 */
function formatFechaLargaES(fechaStr) {
  if (!fechaStr) return 'por definir';
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const parts = String(fechaStr).slice(0, 10).split('-');
  if (parts.length !== 3) return fechaStr;
  const [y, m, d] = parts;
  const mes = meses[parseInt(m, 10) - 1] || m;
  return `${parseInt(d, 10)} de ${mes} del ${y}`;
}

/**
 * Genera y descarga el PDF oficial del Contrato de Compraventa de Terreno Rural
 * basado en la plantilla estándar de Proyecto Campestre La Ceiba.
 */
export function exportContratoPDF(contrato) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 22;

  const checkPageBreak = (needed = 18) => {
    if (y + needed > 258) {
      doc.addPage();
      y = 22;
    }
  };

  const addParagraph = (text, { bold = false, size = 10.5, align = 'justify', spaceAfter = 4.5, lineH = 5.2 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);
    checkPageBreak(lines.length * lineH + spaceAfter);
    doc.text(lines, margin, y, { maxWidth, align });
    y += lines.length * lineH + spaceAfter;
  };

  // Título principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CONTRATO DE COMPRAVENTA DE TERRENO RURAL', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Datos de compradores
  const compradorNombre = String(contrato.cliente_nombre || 'POR DEFINIR').toUpperCase();
  const compradorDoc = formatCedula(contrato.cliente_doc);
  const compradorCiudad = contrato.cliente_ciudad || 'Bogotá';

  const tieneCotitular = Boolean(contrato.cotitular_nombre && contrato.cotitular_nombre.trim());
  const cotitularTxt = tieneCotitular
    ? ` y el/la señor(a) ${contrato.cotitular_nombre.trim().toUpperCase()} mayor de edad, identificado(a) con cédula de ciudadanía número ${formatCedula(contrato.cotitular_doc)} de ${contrato.cotitular_ciudad || compradorCiudad}, actuando en nombre propio, quienes en adelante se denominarán PROMITENTES COMPRADORES`
    : ', actuando en nombre propio, quien en adelante se denominará EL/LA PROMITENTE COMPRADOR(A)';

  // Encabezado
  addParagraph(
    `Entre los suscritos a saber: el señor JOHN ALBERTO BOHORQUEZ ROJAS mayor de edad identificado con cédula de ciudadanía número 1.122.128.330 de Acacías actuando en nombre propio, y quien para los efectos del presente contrato se denominará PROMITENTE VENDEDOR, de una parte; y del otro el/la señor(a) ${compradorNombre} mayor de edad, identificado(a) con cédula de ciudadanía número ${compradorDoc} de ${compradorCiudad}${cotitularTxt}, será celebrado el presente contrato de promesa de compraventa que se rige con las siguientes cláusulas:`
  );

  // PRIMERA
  const etapaTexto = Number(contrato.etapa) === 1 ? 'primera' : 'segunda';
  const loteNum = contrato.lote_num || '-';
  const mzNum = contrato.manzana || '-';
  const areaTxt = contrato.area_m2 || '160';
  const cedCatastral = contrato.cedula_catastral || '00-00-00-00-0017-0183-0-00-00-0000';
  const matricula = contrato.matricula_inmobiliaria || '232-62531';

  addParagraph(
    `PRIMERA-OBJETO. El PROMITENTE VENDEDOR se obliga a vender a EL/LA PROMITENTE COMPRADOR(A): quien adquiere a título de compraventa, el pleno derecho de dominio, propiedad y posesión que tiene y ejerce sobre UN (1) LOTE DE TERRENO RURAL, que hace parte de uno de mayor extensión, distinguido con el número (${loteNum}) de la manzana ${mzNum} equivalente a ${areaTxt} metros cuadrados que hace parte de la ${etapaTexto} etapa del proyecto campestre LA CEIBA, ubicado en la vereda EL CARMEN, jurisdicción del municipio de Guamal, Departamento del Meta, y este se compromete a comprar los respectivos derechos de toda propiedad, dominio, posesión y mejoras que actualmente tiene y ejerce sobre el inmueble: LOTE DE TERRENO RURAL, identificado con Cédula Catastral N. ${cedCatastral} y matrícula inmobiliaria N. ${matricula} de la oficina de registro de instrumentos públicos.`
  );

  // SEGUNDA
  addParagraph(
    'SEGUNDA: TRADICIÓN. - El inmueble que por este contrato se promete vender, por una parte, y comprar por la otra, lo adquirió el PROMITENTE VENDEDOR mediante contrato de compraventa.'
  );

  // TERCERA
  addParagraph(
    'TERCERA: OTRAS OBLIGACIONES. - EL PROMITENTE VENDEDOR se obliga a transferir el dominio de UN LOTE que se desprende de uno de mayor extensión, objeto del presente contrato, libre de venta a tercero, hipotecas o demandas civiles.'
  );

  // CUARTA: PRECIO
  const precio = Number(contrato.precio_venta) || 0;
  const precioLetras = numeroALetrasCOP(precio);
  const inicialTotal = Number(contrato.valor_cuota_inicial) || 0;
  const inicialLetras = numeroALetrasCOP(inicialTotal);
  const arrasPrevias = Number(contrato.arras_previas) || 0;
  const pagoHoyInicial = Math.max(0, inicialTotal - arrasPrevias);
  const saldoFin = Math.max(0, precio - inicialTotal);
  const saldoLetras = numeroALetrasCOP(saldoFin);
  const plazo = Number(contrato.plazo_cuotas) || 0;
  const valorCuota = Number(contrato.valor_cuota) || 0;
  const diaPago = contrato.dias_pago || '15';
  const fechaPrimera = formatFechaLargaES(contrato.fecha_primera_cuota);

  addParagraph(
    `CUARTA: PRECIO. - El precio del lote en venta es de ${precioLetras} (${formatCOP(precio)}) moneda corriente, suma que EL/LA PROMITENTE COMPRADOR(A) pagará AL PROMITENTE VENDEDOR de la siguiente manera:`
  );

  let textoInicial = `• Se cancelará el valor de ${inicialLetras} (${formatCOP(inicialTotal)}) por concepto de cuota inicial a la firma del presente contrato`;
  if (arrasPrevias > 0) {
    textoInicial += `, de los cuales ${formatCOP(arrasPrevias)} corresponden a arras pagadas previamente${contrato.recibo_arras ? ` (Recibo Oficial #${contrato.recibo_arras})` : ''}${pagoHoyInicial > 0 ? ` y ${formatCOP(pagoHoyInicial)} al perfeccionamiento del presente contrato` : ''}.`;
  } else {
    textoInicial += '.';
  }
  addParagraph(textoInicial, { spaceAfter: 3 });

  if (saldoFin > 0 && plazo > 0) {
    addParagraph(
      `• Los restantes ${saldoLetras} (${formatCOP(saldoFin)}) serán cancelados en ${plazo} cuotas mensuales de (${formatCOP(valorCuota)}), la primera para el ${fechaPrimera} y las siguientes todos los días ${diaPago} de cada mes.`,
      { spaceAfter: 5 }
    );
  } else {
    addParagraph('• El lote queda cancelado en su totalidad a la firma del presente contrato.', { spaceAfter: 5 });
  }

  // QUINTA
  addParagraph(
    'QUINTA: CLÁUSULA PENAL. - En caso de incumplimiento de alguna de las partes, los promitentes establecemos una multa penal del 20% del valor total del contrato.'
  );

  if (contrato.observaciones && contrato.observaciones.trim()) {
    addParagraph(`OBSERVACIONES ADICIONALES: ${contrato.observaciones.trim()}`, { size: 9.5 });
  }

  // Firmas
  checkPageBreak(42);
  y += 8;
  addParagraph(
    `Para constancia se firma en el municipio de Acacías / Guamal (Meta), el ${formatFechaLargaES(contrato.fecha_venta || new Date().toISOString().slice(0, 10))}.`,
    { spaceAfter: 16 }
  );

  checkPageBreak(26);
  const colLeft = margin;
  const colRight = pageWidth / 2 + 8;

  doc.setDrawColor(100, 116, 139);
  doc.line(colLeft, y, colLeft + 70, y);
  doc.line(colRight, y, colRight + 70, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('JOHN ALBERTO BOHORQUEZ ROJAS', colLeft, y);
  doc.text(compradorNombre.slice(0, 32), colRight, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('C.C. 1.122.128.330 de Acacías', colLeft, y);
  doc.text(`C.C. ${compradorDoc}`, colRight, y);
  y += 4;
  doc.text('PROMITENTE VENDEDOR', colLeft, y);
  doc.text('PROMITENTE COMPRADOR(A)', colRight, y);

  // Pie de página
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Código de Lote: ${contrato.id_lote || ''} · Generado: ${formatDate(new Date().toISOString().slice(0, 10))}`, margin, 270);

  const safeLote = String(contrato.id_lote || 'Lote').replace(/\s+/g, '_');
  doc.save(`Contrato_${safeLote}.pdf`);
}
