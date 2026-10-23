import { supabase } from '../supabase';
import { registrarAccion } from './auditApi';

const STORAGE_KEY = 'ceiba_observaciones_cobranza_cache';

let inMemoryCobranza = null;

/**
 * Normaliza el string de un lote para búsquedas sin inconsistencias de espacios o guiones.
 */
export function normLote(str) {
  if (!str) return '';
  return str.toUpperCase().replace(/\s+/g, '').replace(/[-_]/g, '');
}

/**
 * Obtiene todas las observaciones de cobranza desde Supabase (datos_maestros tipo OBSERVACION_COBRANZA).
 */
export async function getObservacionesCobranza(forceRefresh = false) {
  if (!forceRefresh && inMemoryCobranza && inMemoryCobranza.length > 0) {
    return inMemoryCobranza;
  }

  let items = [];

  try {
    const { data, error } = await supabase
      .from('datos_maestros')
      .select('id, valor, orden')
      .eq('tipo', 'OBSERVACION_COBRANZA')
      .order('orden', { ascending: true });

    if (!error && data && data.length > 0) {
      items = data.map(d => {
        try {
          const parsed = typeof d.valor === 'string' ? JSON.parse(d.valor) : d.valor;
          return { ...parsed, db_id: d.id };
        } catch {
          return null;
        }
      }).filter(Boolean);

      // Guardar copia local en caso de desconexión
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('Error cargando observaciones de cobranza de Supabase:', err);
  }

  // Si falló o no devolvió nada, usar caché local
  if (items.length === 0 && typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        items = cached;
      }
    } catch {
      // ignore
    }
  }

  inMemoryCobranza = items;
  return items;
}

/**
 * Busca la observación de cobranza correspondiente a un id_lote dado.
 */
export function buscarObservacionCobranza(idLote, listaObservaciones = []) {
  if (!idLote) return null;
  const target = normLote(idLote);
  return listaObservaciones.find(obs => normLote(obs.id_lote) === target) || null;
}

/**
 * Guarda o actualiza una observación de cobranza para un lote.
 * Actualiza la tabla datos_maestros y también actualiza lotes.observacion.
 */
export async function guardarObservacionCobranza(datos, usuarioActual = 'Soporte Mora') {
  const {
    id_lote,
    lote_id,
    gestion,
    respuesta,
    nota,
    fecha,
    observacion_adicional,
    texto_resumen
  } = datos;

  if (!id_lote) {
    throw new Error('id_lote es requerido para guardar la observación de cobranza');
  }

  const todas = await getObservacionesCobranza(true);
  const existente = buscarObservacionCobranza(id_lote, todas);

  const fechaActual = fecha || new Date().toISOString().slice(0, 10);
  const nuevaGestion = gestion || (existente ? existente.gestion : 'LLAMADA TELEFONICA');
  const nuevaRespuesta = respuesta || (existente ? existente.respuesta : 'OBSERVACIÓN REGISTRADA');
  const notaFinal = (nota !== undefined ? nota : (observacion_adicional !== undefined ? observacion_adicional : (existente?.nota || existente?.observacion_adicional || '')))?.trim() || '';

  // Construir texto resumen directo y legible con fecha
  let resumenFinal = texto_resumen;
  if (!resumenFinal) {
    if (notaFinal) {
      resumenFinal = `${nuevaRespuesta}: ${notaFinal} (${fechaActual})`;
    } else {
      resumenFinal = `${nuevaRespuesta} (${fechaActual})`;
    }
  }

  const payloadObjeto = {
    id_lote,
    lote_id: lote_id || existente?.lote_id,
    cliente: datos.cliente || existente?.cliente,
    gestion: nuevaGestion,
    respuesta: nuevaRespuesta,
    nota: notaFinal || null,
    observacion_adicional: notaFinal || null,
    fecha: fechaActual,
    texto_resumen: resumenFinal,
    autor: typeof usuarioActual === 'string'
      ? usuarioActual
      : (usuarioActual?.user_metadata?.nombre || usuarioActual?.nombre || usuarioActual?.email || 'Diana (Soporte)'),
    updated_at: new Date().toISOString()
  };

  try {
    if (existente && existente.db_id) {
      // Actualizar registro existente en datos_maestros
      await supabase
        .from('datos_maestros')
        .update({
          valor: JSON.stringify(payloadObjeto)
        })
        .eq('id', existente.db_id);
    } else {
      // Insertar nuevo registro en datos_maestros
      const { data: inserted } = await supabase
        .from('datos_maestros')
        .insert([{
          tipo: 'OBSERVACION_COBRANZA',
          valor: JSON.stringify(payloadObjeto),
          orden: todas.length + 1
        }])
        .select('id')
        .single();

      if (inserted) {
        payloadObjeto.db_id = inserted.id;
      }
    }

    // Actualizar también el campo observacion en la tabla lotes si se tiene lote_id o buscando por id_lote
    if (lote_id) {
      await supabase
        .from('lotes')
        .update({ observacion: resumenFinal })
        .eq('id', lote_id);
    } else {
      await supabase
        .from('lotes')
        .update({ observacion: resumenFinal })
        .eq('id_lote', id_lote);
    }

    // Registrar acción de auditoría
    const autorNombre = typeof usuarioActual === 'object'
      ? (usuarioActual?.user_metadata?.nombre || usuarioActual?.nombre || usuarioActual?.email || 'Diana (Soporte)')
      : (usuarioActual || 'Diana (Soporte)');
    const autorEmail = typeof usuarioActual === 'object'
      ? (usuarioActual?.email || 'diana@ceiba.com')
      : 'diana@ceiba.com';
    const autorRole = typeof usuarioActual === 'object'
      ? (usuarioActual?.user_metadata?.role || 'soporte')
      : 'soporte';

    await registrarAccion({
      modulo: 'CARTERA',
      accion: 'OBSERVACION_COBRANZA',
      lote_id_str: id_lote,
      lote_id: lote_id || existente?.lote_id,
      cliente_nombre: payloadObjeto.cliente || '—',
      descripcion: `Observación de cobranza registrada para lote ${id_lote}: "${resumenFinal}"`,
      detalles: payloadObjeto,
      usuario: {
        nombre: autorNombre,
        email: autorEmail,
        role: autorRole
      }
    });

  } catch (err) {
    console.error('Error persistiendo observación de cobranza en Supabase:', err);
  }

  // Invalidar caché en memoria
  inMemoryCobranza = null;
  return payloadObjeto;
}
