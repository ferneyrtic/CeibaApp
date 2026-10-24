import * as sbModule from '../supabase.js';
const supabase = sbModule.supabase;
const supabaseAdmin = sbModule.supabaseAdmin || sbModule.supabase;
import { registrarAccion } from './auditApi.js';
import { clearCarteraCache } from './cartera.js';

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
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
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
 * Retorna la observación efectiva de un lote asegurando que las observaciones registradas
 * en el sistema (con autor, fecha y gestión detallada) prevalezcan de forma transparente.
 */
export function obtenerObservacionEfectiva(idLote, listaObservaciones = [], obsDirecta = null) {
  const obsObj = buscarObservacionCobranza(idLote, listaObservaciones);
  if (obsObj && obsObj.texto_resumen) {
    return obsObj;
  }
  if (obsDirecta && obsDirecta.trim()) {
    return {
      ...(obsObj || {}),
      id_lote: idLote,
      texto_resumen: obsDirecta.trim(),
      nota: obsObj?.nota || obsDirecta.trim(),
      respuesta: obsObj?.respuesta || obsDirecta.trim()
    };
  }
  return obsObj || null;
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

  // Construir texto resumen directo, limpio y legible con fecha (evitando repeticiones)
  let resumenFinal = texto_resumen;
  if (!resumenFinal) {
    let cleanNota = (notaFinal || '').trim();
    if (cleanNota.toLowerCase().startsWith(nuevaRespuesta.toLowerCase())) {
      cleanNota = cleanNota.slice(nuevaRespuesta.length).replace(/^[:\s\-]+/, '').trim();
    }
    const hasDateAtEnd = /\(\d{4}-\d{2}-\d{2}\)$/.test(cleanNota);

    if (cleanNota) {
      resumenFinal = hasDateAtEnd
        ? `${nuevaRespuesta}: ${cleanNota}`
        : `${nuevaRespuesta}: ${cleanNota} (${fechaActual})`;
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
    const client = supabaseAdmin || supabase;

    if (existente && existente.db_id) {
      // Actualizar registro existente en datos_maestros
      const { error: upErr } = await client
        .from('datos_maestros')
        .update({
          valor: JSON.stringify(payloadObjeto)
        })
        .eq('id', existente.db_id);

      if (upErr) {
        console.error('Error actualizando OBSERVACION_COBRANZA en datos_maestros:', upErr);
        throw upErr;
      }
    } else {
      // Insertar nuevo registro en datos_maestros
      const { data: inserted, error: inErr } = await client
        .from('datos_maestros')
        .insert([{
          tipo: 'OBSERVACION_COBRANZA',
          valor: JSON.stringify(payloadObjeto),
          orden: Math.floor(Date.now() / 1000)
        }])
        .select('id')
        .single();

      if (inErr) {
        console.error('Error insertando OBSERVACION_COBRANZA en datos_maestros:', inErr);
        throw inErr;
      }
      if (inserted) {
        payloadObjeto.db_id = inserted.id;
      }
    }

    // Actualizar también el campo observacion en la tabla lotes usando client administrativo
    if (lote_id) {
      await client
        .from('lotes')
        .update({ observacion: resumenFinal, updated_at: new Date().toISOString() })
        .eq('id', lote_id);
    }
    if (id_lote) {
      await client
        .from('lotes')
        .update({ observacion: resumenFinal, updated_at: new Date().toISOString() })
        .eq('id_lote', id_lote);
    }

    // Registrar acción de auditoría — OBLIGATORIO: si falla, la observación se revierte
    const autorNombre = typeof usuarioActual === 'object'
      ? (usuarioActual?.user_metadata?.nombre || usuarioActual?.nombre || usuarioActual?.email || 'Soporte Mora')
      : (usuarioActual || 'Soporte Mora');
    const autorEmail = typeof usuarioActual === 'object'
      ? (usuarioActual?.email || 'soporte@ceiba.com')
      : 'soporte@ceiba.com';
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
      throwOnFailure: true,
      usuario: {
        nombre: autorNombre,
        email: autorEmail,
        role: autorRole
      }
    });

  } catch (err) {
    console.error('Error persistiendo observación de cobranza en Supabase:', err);
    throw err;
  }

  // Invalidar caché en memoria, local y de cartera
  inMemoryCobranza = null;
  try {
    clearCarteraCache();
  } catch (e) {}
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }
  return payloadObjeto;
}
