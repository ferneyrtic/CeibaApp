import { supabase } from '../supabase';
import { registrarAccion } from './auditApi';

const STORAGE_KEY = 'ceiba_casos_especiales_data';

export const CATEGORIAS_CASOS = [
  { id: 'PARTE_DE_PAGO', label: 'Dación en Pago / Permuta', icon: '🚗', color: '#6d28d9', bg: '#ede9fe' },
  { id: 'TRASLADO_DINERO', label: 'Traslado de Fondos en Tránsito', icon: '🔄', color: '#b45309', bg: '#fef3c7' },
  { id: 'DESCUENTO_COMERCIAL', label: 'Ajuste Comercial / Descuento', icon: '⚖️', color: '#b91c1c', bg: '#fee2e2' },
  { id: 'TITULAR_TRAMITE', label: 'Titular en Trámite Jurídico', icon: '👤', color: '#0369a1', bg: '#e0f2fe' },
  { id: 'OBSERVACION_GENERAL', label: 'Observación Operativa General', icon: '📝', color: '#475569', bg: '#f1f5f9' },
];

export const ESTADOS_CASOS = [
  { id: 'EN_TRAMITE', label: 'En Trámite', color: '#d97706', bg: '#fef3c7' },
  { id: 'BLOQUEADO', label: 'Pendiente / Requiere Acción', color: '#dc2626', bg: '#fee2e2' },
  { id: 'RESUELTO', label: 'Resuelto / Aplicado', color: '#16a34a', bg: '#dcfce7' },
];

/**
 * Casos iniciales detectados en las auditorías históricas del proyecto.
 */
const CASOS_SEMILLA = [
  {
    id: 'caso_lc2_28_2',
    id_lote: 'LC2 - 28 - 2',
    categoria: 'TRASLADO_DINERO',
    estado: 'EN_TRAMITE',
    titulo: 'Dinero en Tránsito ($6.000.000)',
    monto_asociado: 6000000,
    lote_destino: 'LC2 - 28 - 3',
    cliente: 'Gildardo López',
    observacion: 'Fondos de abono inicial en proceso de traslado contable hacia el lote de reemplazo convenido.',
    fecha_creacion: '2026-08-20',
    historial_notas: [
      { fecha: '2026-08-20', nota: 'Abono de $6.000.000 retenido para cruce de cuentas.', autor: 'Auditoría Inicial' }
    ]
  },
  {
    id: 'caso_lc2_28_3',
    id_lote: 'LC2 - 28 - 3',
    categoria: 'TRASLADO_DINERO',
    estado: 'EN_TRAMITE',
    titulo: 'Recepción de Fondos en Tránsito',
    monto_asociado: 6000000,
    lote_destino: '',
    cliente: 'Gildardo López',
    observacion: 'Lote receptor de saldo pendiente por cruzar desde el lote LC2-28-2.',
    fecha_creacion: '2026-08-20',
    historial_notas: [
      { fecha: '2026-08-20', nota: 'Pendiente confirmar cruce en extracto bancario.', autor: 'Auditoría Inicial' }
    ]
  },
  {
    id: 'caso_lc1_4_5',
    id_lote: 'LC1 - 4 - 5',
    categoria: 'PARTE_DE_PAGO',
    estado: 'EN_TRAMITE',
    titulo: 'Permuta Parcial (Vehículo recibido)',
    monto_asociado: 15000000,
    lote_destino: '',
    cliente: 'Carlos Rodríguez',
    observacion: 'Negociación especial donde se recibió vehículo como parte de pago de la cuota inicial y abonos.',
    fecha_creacion: '2026-08-15',
    historial_notas: [
      { fecha: '2026-08-15', nota: 'Vehículo recibido en custodia y peritado.', autor: 'Administración' }
    ]
  },
  {
    id: 'caso_lc1_20_3',
    id_lote: 'LC1 - 20 - 3',
    categoria: 'DESCUENTO_COMERCIAL',
    estado: 'EN_TRAMITE',
    titulo: 'Descuento Asesor ($1.500.000)',
    monto_asociado: 1500000,
    lote_destino: '',
    cliente: 'Marta Lucía Gómez',
    observacion: 'Descuento comercial aprobado por gerencia sobre el saldo financiado.',
    fecha_creacion: '2026-08-10',
    historial_notas: [
      { fecha: '2026-08-10', nota: 'Descuento autorizado por acuerdo comercial directo.', autor: 'Ventas' }
    ]
  },
  {
    id: 'caso_lc2_27_12',
    id_lote: 'LC2 - 27 - 12',
    categoria: 'TITULAR_TRAMITE',
    estado: 'BLOQUEADO',
    titulo: 'Cesión de Derechos en Trámite',
    monto_asociado: 0,
    lote_destino: '',
    cliente: 'Jeisson Villanueva García',
    observacion: 'Falta formalizar documento de identidad y firma de cesión del contrato.',
    fecha_creacion: '2026-08-27',
    historial_notas: [
      { fecha: '2026-08-27', nota: 'Caso detectado en auditoría contable pendiente de documentación.', autor: 'Auditoría Forense' }
    ]
  }
];

/**
 * Normaliza el string de un lote para búsquedas exactas.
 */
function normLote(str) {
  if (!str) return '';
  return str.toUpperCase().replace(/\s+/g, '').replace(/[-_]/g, '');
}

let inMemoryCasos = null;

/**
 * Obtiene todos los casos especiales guardados (mezclando Supabase, semilla y caché local).
 */
export async function getCasosEspeciales() {
  if (inMemoryCasos && inMemoryCasos.length > 0) {
    return inMemoryCasos;
  }

  let casos = [];

  // 1. Cargar desde Supabase `datos_maestros`
  try {
    const { data, error } = await supabase
      .from('datos_maestros')
      .select('id, valor, orden')
      .eq('tipo', 'CASO_ESPECIAL')
      .order('orden', { ascending: false });

    if (!error && data && data.length > 0) {
      casos = data.map(d => {
        try {
          const parsed = typeof d.valor === 'string' ? JSON.parse(d.valor) : d.valor;
          return { ...parsed, db_id: d.id };
        } catch {
          return null;
        }
      }).filter(Boolean);
    }
  } catch (err) {
    console.warn('Error leyendo casos de Supabase, usando almacenamiento local:', err);
  }

  // 2. Si no hay en Supabase, inicializar con la semilla y el caché local
  if (casos.length === 0) {
    try {
      const cached = typeof window !== 'undefined' && window.localStorage
        ? JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
        : null;
      if (cached && Array.isArray(cached) && cached.length > 0) {
        casos = cached;
      } else {
        casos = [...CASOS_SEMILLA];
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(casos));
        }
      }
    } catch {
      casos = [...CASOS_SEMILLA];
    }
  }

  inMemoryCasos = casos;
  return casos;
}

/**
 * Crea o actualiza un caso especial en el sistema.
 */
export async function guardarCasoEspecial(casoData, usuarioActual) {
  const casos = await getCasosEspeciales();
  const idLote = casoData.id_lote?.trim();
  const esNuevo = !casoData.id || casoData.id.startsWith('temp_');

  const nuevoId = esNuevo
    ? `caso_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    : casoData.id;

  const casoGuardado = {
    ...casoData,
    id: nuevoId,
    id_lote: idLote,
    fecha_actualizacion: new Date().toISOString().slice(0, 10),
  };

  if (esNuevo) {
    casoGuardado.fecha_creacion = new Date().toISOString().slice(0, 10);
    casoGuardado.historial_notas = casoGuardado.historial_notas || [
      {
        fecha: new Date().toISOString().slice(0, 10),
        nota: casoGuardado.observacion || 'Caso registrado en el sistema',
        autor: usuarioActual?.nombre || 'Secretaría'
      }
    ];
  }

  // Actualizar lista en memoria
  const index = casos.findIndex(c => c.id === nuevoId || normLote(c.id_lote) === normLote(idLote));
  let casosActualizados;
  if (index >= 0) {
    casosActualizados = [...casos];
    casosActualizados[index] = { ...casos[index], ...casoGuardado };
  } else {
    casosActualizados = [casoGuardado, ...casos];
  }

  inMemoryCasos = casosActualizados;

  // 1. Guardar en localStorage si existe window
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(casosActualizados));
    } catch (e) {
      console.warn('Error guardando en caché local:', e);
    }
  }

  // 2. Persistir en Supabase `datos_maestros`
  try {
    if (casoGuardado.db_id) {
      await supabase
        .from('datos_maestros')
        .update({
          valor: JSON.stringify(casoGuardado),
          orden: Date.now() % 1000000000
        })
        .eq('id', casoGuardado.db_id);
    } else {
      const { data } = await supabase
        .from('datos_maestros')
        .insert({
          tipo: 'CASO_ESPECIAL',
          valor: JSON.stringify(casoGuardado),
          orden: Date.now() % 1000000000
        })
        .select()
        .single();

      if (data) casoGuardado.db_id = data.id;
    }
  } catch (e) {
    console.warn('Aviso guardando caso en Supabase:', e);
  }

  // 3. Sincronizar campo `observacion` en la tabla `lotes` si se tiene el lote
  try {
    const textoObs = `[${casoGuardado.titulo || casoGuardado.categoria}] ${casoGuardado.observacion || ''}`;
    await supabase
      .from('lotes')
      .update({ observacion: textoObs })
      .ilike('id_lote', `%${idLote.replace(/\s+/g, '%')}%`);
  } catch (e) {
    console.warn('Aviso actualizando observacion en lotes:', e);
  }

  // 4. Registrar en el Log de Auditoría
  try {
    await registrarAccion({
      modulo: 'CASOS_ESPECIALES',
      accion: esNuevo ? 'CASO_ESPECIAL_CREADO' : 'CASO_ESPECIAL_ACTUALIZADO',
      lote_id_str: idLote,
      cliente_nombre: casoGuardado.cliente || '—',
      descripcion: `${esNuevo ? 'Se creó' : 'Se actualizó'} el caso especial: "${casoGuardado.titulo}" (${casoGuardado.categoria}) con estado ${casoGuardado.estado}`,
      detalles: {
        categoria: casoGuardado.categoria,
        monto: casoGuardado.monto_asociado,
        lote_destino: casoGuardado.lote_destino,
        estado: casoGuardado.estado
      },
      usuario: usuarioActual
    });
  } catch (e) {
    console.warn('Aviso registrando auditoría:', e);
  }

  return casoGuardado;
}

/**
 * Elimina o resuelve un caso especial.
 */
export async function eliminarCasoEspecial(id, usuarioActual) {
  const casos = await getCasosEspeciales();
  const casoEncontrado = casos.find(c => c.id === id);
  const filtrados = casos.filter(c => c.id !== id);

  inMemoryCasos = filtrados;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtrados));
    } catch (e) {
      console.warn(e);
    }
  }

  if (casoEncontrado?.db_id) {
    try {
      await supabase
        .from('datos_maestros')
        .delete()
        .eq('id', casoEncontrado.db_id);
    } catch (e) {
      console.warn(e);
    }
  }

  // Registrar en auditoría
  if (casoEncontrado) {
    await registrarAccion({
      modulo: 'CASOS_ESPECIALES',
      accion: 'CASO_ESPECIAL_ELIMINADO',
      lote_id_str: casoEncontrado.id_lote,
      cliente_nombre: casoEncontrado.cliente,
      descripcion: `Se eliminó el caso especial "${casoEncontrado.titulo}" del lote ${casoEncontrado.id_lote}`,
      usuario: usuarioActual
    });
  }

  return true;
}

/**
 * Agrega una nota de seguimiento a un caso existente.
 */
export async function agregarNotaSeguimiento(casoId, notaTexto, usuarioActual) {
  const casos = await getCasosEspeciales();
  const caso = casos.find(c => c.id === casoId);
  if (!caso) throw new Error('Caso especial no encontrado');

  const nuevaNota = {
    fecha: new Date().toISOString().slice(0, 10),
    hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    nota: notaTexto,
    autor: usuarioActual?.nombre || 'Secretaría'
  };

  caso.historial_notas = [nuevaNota, ...(caso.historial_notas || [])];
  return await guardarCasoEspecial(caso, usuarioActual);
}

/**
 * Obtiene el tag o badge para la tabla general de cartera a partir del id_lote.
 */
export function obtenerBadgeCasoEspecial(idLote, listaCasos = []) {
  if (!idLote) return null;
  const n = normLote(idLote);

  const caso = listaCasos.find(c => normLote(c.id_lote) === n && c.estado !== 'RESUELTO');
  if (!caso) return null;

  const cat = CATEGORIAS_CASOS.find(c => c.id === caso.categoria) || CATEGORIAS_CASOS[0];
  return {
    casoId: caso.id,
    titulo: caso.titulo,
    categoria: caso.categoria,
    monto: caso.monto_asociado,
    text: caso.titulo || cat.label,
    icon: cat.icon,
    color: cat.color,
    bg: cat.bg,
    estado: caso.estado,
    rawCaso: caso
  };
}

/**
 * Exporta el reporte de casos especiales a Excel.
 */
export async function exportarCasosEspecialesExcel(casos) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const rows = casos.map((c, idx) => {
    const cat = CATEGORIAS_CASOS.find(cat => cat.id === c.categoria)?.label || c.categoria;
    const est = ESTADOS_CASOS.find(e => e.id === c.estado)?.label || c.estado;
    return {
      '#': idx + 1,
      'LOTE': c.id_lote,
      'CLIENTE': c.cliente || '—',
      'TÍTULO DEL CASO': c.titulo,
      'CATEGORÍA': cat,
      'ESTADO': est,
      'MONTO ASOCIADO ($)': c.monto_asociado || 0,
      'LOTE DESTINO': c.lote_destino || '—',
      'FECHA REGISTRO': c.fecha_creacion || '—',
      'OBSERVACIÓN DETALLADA': c.observacion || '—',
      'ÚLTIMO AVANCE': c.historial_notas?.[0]?.nota || '—'
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 26 },
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 50 }, { wch: 45 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Casos Especiales La Ceiba');
  XLSX.writeFile(wb, `Casos_Especiales_LaCeiba_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
