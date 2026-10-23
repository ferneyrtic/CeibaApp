import * as sbModule from '../supabase.js';
const supabase = sbModule.supabase;
const supabaseAdmin = sbModule.supabaseAdmin || sbModule.supabase;
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

let gastosCache = null;
let gastosCacheTime = 0;

export const clearGastosCache = () => {
  gastosCache = null;
  gastosCacheTime = 0;
};

const getGastosLocales = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Purgar cualquier dato de prueba / semilla antiguo (gasto_seed_*)
    const limpios = parsed.filter(g => g && g.id && !String(g.id).startsWith('gasto_seed_'));
    if (limpios.length !== parsed.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limpios));
    }
    return limpios;
  } catch (e) {
    return [];
  }
};

const saveGastosLocales = (gastos) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    // Asegurar que nunca se persistan semillas
    const limpios = (gastos || []).filter(g => g && g.id && !String(g.id).startsWith('gasto_seed_'));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limpios));
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
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('datos_maestros')
      .select('id, orden, valor, created_at')
      .eq('tipo', 'GASTO_PROYECTO')
      .order('created_at', { ascending: false });

    if (!error && data) {
      data.forEach(item => {
        try {
          const parsed = typeof item.valor === 'string' ? JSON.parse(item.valor) : item.valor;
          if (parsed && parsed.id && String(parsed.id).startsWith('gasto_seed_')) return;
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
    const client = supabaseAdmin || supabase;
    if (payload.db_id) {
      await client
        .from('datos_maestros')
        .update({
          valor: JSON.stringify(payload)
        })
        .eq('id', payload.db_id);
    } else {
      const { data, error } = await client
        .from('datos_maestros')
        .insert([{
          tipo: 'GASTO_PROYECTO',
          orden: Date.now() % 1000000000,
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
      const client = supabaseAdmin || supabase;
      await client
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
