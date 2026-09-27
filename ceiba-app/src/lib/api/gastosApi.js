import { supabase } from '../supabase';
import { registrarAccion } from './auditApi';
import { formatCOP, formatDate } from '../../utils/helpers';

const STORAGE_KEY = 'ceiba_gastos_proyecto_data';

export const CATEGORIAS_GASTOS = [
  { id: 'MATERIALES', label: 'Materiales de Obra (Cemento, Arena, Varilla, etc.)', shortLabel: 'Materiales de Obra', icon: '🧱', color: '#b45309', bg: '#fef3c7' },
  { id: 'MANO_OBRA', label: 'Mano de Obra & Nómina de Trabajadores', shortLabel: 'Mano de Obra', icon: '👷', color: '#1d4ed8', bg: '#eff6ff' },
  { id: 'MAQUINARIA', label: 'Maquinaria, Volquetas & Combustible (ACPM)', shortLabel: 'Maquinaria & ACPM', icon: '🚜', color: '#c2410c', bg: '#ffedd5' },
  { id: 'SERVICIOS_OFICINA', label: 'Servicios Públicos, Internet & Oficina', shortLabel: 'Servicios & Oficina', icon: '💡', color: '#0369a1', bg: '#e0f2fe' },
  { id: 'HONORARIOS_LEGAL', label: 'Topografía, Honorarios Jurídicos & Trámites', shortLabel: 'Honorarios & Legal', icon: '⚖️', color: '#6d28d9', bg: '#ede9fe' },
  { id: 'MANTENIMIENTO', label: 'Mantenimiento de Vías, Guadaña & Cercas', shortLabel: 'Mantenimiento Vías', icon: '🌿', color: '#15803d', bg: '#dcfce7' },
  { id: 'VARIOS_OTROS', label: 'Gastos Operativos Varios / Imprevistos', shortLabel: 'Varios / Imprevistos', icon: '📦', color: '#475569', bg: '#f1f5f9' },
];

export const MEDIOS_PAGO_GASTOS = ['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'OTRO'];

/**
 * Semilla inicial con registros realistas del proyecto para ilustrar el control
 */
const GASTOS_SEMILLA = [
  {
    id: 'gasto_seed_1',
    fecha: '2026-09-18',
    categoria: 'MATERIALES',
    concepto: 'Compra de 70 bultos de cemento gris Argos para fundición de cunetas y bordillos',
    proveedor: 'Ferretería El Progreso - Acacías',
    numero_factura: 'FAC-48912',
    medio_pago: 'TRANSFERENCIA',
    banco: 'Bancolombia',
    referencia: 'TR-892341',
    valor: 2450000,
    observaciones: 'Material entregado en obra. Recibido por maestro de obra.',
    registrado_por: 'Propietario',
    created_at: '2026-09-18T10:30:00.000Z'
  },
  {
    id: 'gasto_seed_2',
    fecha: '2026-09-21',
    categoria: 'MAQUINARIA',
    concepto: 'Alquiler de Retroexcavadora (22 horas) y 50 galones de ACPM para adecuación de vías',
    proveedor: 'Maquinaria y Transportes del Llano',
    numero_factura: 'CC-1082',
    medio_pago: 'TRANSFERENCIA',
    banco: 'Bancolombia',
    referencia: 'TR-901234',
    valor: 3850000,
    observaciones: 'Trabajo de cuneteo y nivelación de la calzada de acceso principal.',
    registrado_por: 'Propietario',
    created_at: '2026-09-21T16:00:00.000Z'
  },
  {
    id: 'gasto_seed_3',
    fecha: '2026-09-24',
    categoria: 'MANO_OBRA',
    concepto: 'Jornales y pago de nómina quincenal a cuadrilla de 4 oficiales de obra',
    proveedor: 'Nómina Cuadrilla de Obra',
    numero_factura: 'NOM-2026-09-Q2',
    medio_pago: 'EFECTIVO',
    banco: '',
    referencia: 'Recibo Caja #3180',
    valor: 3200000,
    observaciones: 'Firmada planilla de pago por el maestro y oficiales a satisfacción.',
    registrado_por: 'Propietario',
    created_at: '2026-09-24T18:00:00.000Z'
  },
  {
    id: 'gasto_seed_4',
    fecha: '2026-09-25',
    categoria: 'HONORARIOS_LEGAL',
    concepto: 'Servicios de topografía: levantamiento planimétrico y replanteo de linderos Etapa 2',
    proveedor: 'Ing. Topógrafo Carlos Méndez',
    numero_factura: 'CC-094',
    medio_pago: 'TRANSFERENCIA',
    banco: 'Davivienda',
    referencia: 'TR-918273',
    valor: 1600000,
    observaciones: 'Entrega de planos en DWG y PDF con coordenadas Magna-Sirgas.',
    registrado_por: 'Propietario',
    created_at: '2026-09-25T11:00:00.000Z'
  }
];

let gastosCache = null;
let gastosCacheTime = 0;

export const clearGastosCache = () => {
  gastosCache = null;
  gastosCacheTime = 0;
};

const getGastosLocales = () => {
  if (typeof window === 'undefined' || !window.localStorage) return GASTOS_SEMILLA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(GASTOS_SEMILLA));
      return GASTOS_SEMILLA;
    }
    return JSON.parse(raw);
  } catch (e) {
    return GASTOS_SEMILLA;
  }
};

const saveGastosLocales = (gastos) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gastos));
  } catch (e) {
    console.warn('Error guardando gastos en localStorage:', e);
  }
};

/**
 * Consulta todos los gastos de obra registrados (unifica Supabase y LocalStorage)
 */
export const getGastos = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && gastosCache && (now - gastosCacheTime < 15000)) {
    return gastosCache;
  }

  const mapa = new Map();

  // 1. Cargar desde LocalStorage
  const locales = getGastosLocales();
  locales.forEach(g => {
    if (g && g.id) mapa.set(g.id, g);
  });

  // 2. Cargar desde Supabase datos_maestros (tipo: GASTO_PROYECTO)
  try {
    const { data, error } = await supabase
      .from('datos_maestros')
      .select('id, orden, valor, created_at')
      .eq('tipo', 'GASTO_PROYECTO')
      .order('created_at', { ascending: false });

    if (!error && data) {
      data.forEach(item => {
        try {
          const parsed = typeof item.valor === 'string' ? JSON.parse(item.valor) : item.valor;
          const idFinal = parsed.id || `gasto_db_${item.id}`;
          mapa.set(idFinal, {
            ...parsed,
            id: idFinal,
            db_id: item.id,
            created_at: parsed.created_at || item.created_at
          });
        } catch (e) {}
      });
    }
  } catch (err) {
    console.warn('Aviso cargando gastos desde Supabase (usando réplica local):', err);
  }

  const list = Array.from(mapa.values()).sort((a, b) => {
    const fA = a.fecha || a.created_at || '';
    const fB = b.fecha || b.created_at || '';
    return fB.localeCompare(fA);
  });

  gastosCache = list;
  gastosCacheTime = now;
  saveGastosLocales(list);
  return list;
};

/**
 * Consulta gastos dentro de un rango de fechas (para integración con Cierre Mensual)
 */
export const getGastosEnRango = async (fechaDesde, fechaHasta) => {
  const todos = await getGastos();
  return todos.filter(g => {
    const f = g.fecha || (g.created_at ? g.created_at.slice(0, 10) : '');
    return f && f >= fechaDesde && f <= fechaHasta;
  });
};

/**
 * Guarda o actualiza un gasto en Supabase y LocalStorage con auditoría
 */
export const guardarGasto = async (gastoData, usuarioActual = 'Propietario') => {
  const id = gastoData.id || `gasto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const valorNum = Math.round(Number(gastoData.valor) || 0);

  if (valorNum <= 0) {
    throw new Error('El valor del gasto debe ser un monto numérico positivo.');
  }

  if (!gastoData.concepto || !gastoData.concepto.trim()) {
    throw new Error('El concepto o descripción del gasto es obligatorio.');
  }

  const payload = {
    ...gastoData,
    id,
    valor: valorNum,
    fecha: gastoData.fecha || new Date().toISOString().slice(0, 10),
    categoria: gastoData.categoria || 'VARIOS_OTROS',
    medio_pago: gastoData.medio_pago || 'TRANSFERENCIA',
    registrado_por: gastoData.registrado_por || usuarioActual,
    created_at: gastoData.created_at || new Date().toISOString()
  };

  // 1. Guardar localmente
  const locales = getGastosLocales();
  const idx = locales.findIndex(g => g.id === id);
  if (idx >= 0) {
    locales[idx] = { ...locales[idx], ...payload };
  } else {
    locales.unshift(payload);
  }
  saveGastosLocales(locales);

  // 2. Guardar en Supabase datos_maestros (con graceful fallback)
  try {
    if (payload.db_id) {
      await supabase
        .from('datos_maestros')
        .update({
          valor: JSON.stringify(payload)
        })
        .eq('id', payload.db_id);
    } else {
      const { data, error } = await supabase
        .from('datos_maestros')
        .insert([{
          tipo: 'GASTO_PROYECTO',
          orden: Date.now(),
          valor: JSON.stringify(payload)
        }])
        .select()
        .single();

      if (!error && data) {
        payload.db_id = data.id;
      }
    }
  } catch (e) {
    console.warn('Aviso guardando gasto en Supabase datos_maestros:', e);
  }

  clearGastosCache();

  // 3. Auditoría
  try {
    await registrarAccion({
      modulo: 'GASTOS_PROYECTO',
      accion: gastoData.id ? 'EDICION_GASTO' : 'CREACION_GASTO',
      lote_id_str: `Gasto: ${payload.categoria}`,
      descripcion: `Registro de Gasto de Obra por ${formatCOP(valorNum)} (${payload.concepto}) a favor de ${payload.proveedor || 'Proveedor'}. Registrado por ${usuarioActual}.`
    });
  } catch (eAudit) {
    console.warn('Aviso auditoría gasto:', eAudit);
  }

  return payload;
};

/**
 * Elimina un gasto registrado
 */
export const eliminarGasto = async (id, usuarioActual = 'Propietario') => {
  const todos = await getGastos();
  const gasto = todos.find(g => g.id === id);

  // 1. Eliminar localmente
  const actualizados = todos.filter(g => g.id !== id);
  saveGastosLocales(actualizados);

  // 2. Eliminar de Supabase si tiene db_id
  if (gasto?.db_id) {
    try {
      await supabase
        .from('datos_maestros')
        .delete()
        .eq('id', gasto.db_id);
    } catch (e) {
      console.warn('Aviso eliminando de Supabase:', e);
    }
  }

  clearGastosCache();

  // 3. Auditoría
  try {
    await registrarAccion({
      modulo: 'GASTOS_PROYECTO',
      accion: 'ELIMINACION_GASTO',
      lote_id_str: `Gasto: ${gasto?.categoria || 'General'}`,
      descripcion: `Eliminación de Gasto #${id} (${gasto?.concepto || ''}) por ${formatCOP(gasto?.valor || 0)} por ${usuarioActual}.`
    });
  } catch (eAudit) {}

  return true;
};

/**
 * Exporta el listado de gastos a Excel
 */
export const exportarGastosExcel = async (gastos, titulo = 'Gastos_Proyecto_La_Ceiba') => {
  const rows = gastos.map(g => {
    const cat = CATEGORIAS_GASTOS.find(c => c.id === g.categoria)?.shortLabel || g.categoria;
    return {
      'Fecha': g.fecha,
      'Categoría': cat,
      'Concepto / Detalle': g.concepto,
      'Proveedor / Beneficiario': g.proveedor || '—',
      'Factura / Soporte': g.numero_factura || '—',
      'Medio de Pago': g.medio_pago || 'TRANSFERENCIA',
      'Banco': g.banco || '—',
      'Referencia': g.referencia || '—',
      'Valor ($ COP)': Number(g.valor) || 0,
      'Registrado Por': g.registrado_por || '—',
      'Observaciones': g.observaciones || '—'
    };
  });

  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos de Obra');
  XLSX.writeFile(wb, `${titulo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Exporta el informe de gastos a PDF
 */
export const exportarGastosPDF = async (gastos, kpis, periodoStr = 'Todos los Gastos') => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  // Cabecera institucional
  doc.setFillColor(22, 163, 74); // Verde institucional
  doc.rect(0, 0, 279, 18, 'F');

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('PROYECTO CAMPESTRE LA CEIBA — INFORME DE GASTOS DE OBRA Y OPERACIÓN', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`Período / Filtro: ${periodoStr}   |   Generado el: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}   |   Total Registros: ${gastos.length}`, 14, 25);

  // Tarjetas de Resumen
  const total = kpis?.total || gastos.reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, 28, 80, 14, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('TOTAL GASTOS EJECUTADOS', 18, 33);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(formatCOP(total), 18, 39);

  // Tabla
  const body = gastos.map((g, idx) => {
    const cat = CATEGORIAS_GASTOS.find(c => c.id === g.categoria)?.shortLabel || g.categoria;
    return [
      idx + 1,
      g.fecha || '—',
      cat,
      g.concepto,
      g.proveedor || '—',
      g.numero_factura || '—',
      g.medio_pago || 'TRANSF.',
      formatCOP(g.valor)
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [['#', 'Fecha', 'Categoría', 'Concepto / Descripción', 'Proveedor', 'Soporte', 'Medio', 'Valor COP']],
    body,
    theme: 'grid',
    headStyles: { fillColor: [24, 40, 24], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 32 },
      3: { cellWidth: 80 },
      4: { cellWidth: 42 },
      5: { cellWidth: 24 },
      6: { cellWidth: 22 },
      7: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] }
    },
    styles: { overflow: 'linebreak', cellPadding: 2 }
  });

  doc.save(`Informe_Gastos_La_Ceiba_${new Date().toISOString().slice(0, 10)}.pdf`);
};
