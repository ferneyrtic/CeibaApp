import { supabase } from '../supabase';
import { numeroALetrasCOP } from '../../utils/numeroALetras';
import { registrarAccion } from './auditApi';

const CONSECUTIVO_INICIAL = 3175;
const LOCAL_STORAGE_KEY = 'ceiba_recibos_caja';

// Cache en memoria para recibos (TTL 15s)
let recibosCache = null;
let recibosCacheTime = 0;

export const clearRecibosCache = () => {
  recibosCache = null;
  recibosCacheTime = 0;
};

/**
 * Lee los recibos guardados en el almacenamiento del navegador.
 */
const obtenerRecibosLocales = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Persiste un recibo de caja en el almacenamiento local.
 */
const guardarReciboLocal = (recibo) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const list = obtenerRecibosLocales();
    const idx = list.findIndex(r => Number(r.numero_recibo) === Number(recibo.numero_recibo));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...recibo };
    } else {
      list.unshift(recibo);
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 1000)));
  } catch (e) {
    console.warn('Aviso guardando recibo local:', e);
  }
};

/**
 * Obtiene el siguiente número de recibo consecutivo autoincrementable.
 * Inicia en 3175 si no existen recibos previos.
 */
export const obtenerSiguienteNumeroRecibo = async () => {
  let maxNum = CONSECUTIVO_INICIAL - 1;

  // 1. Verificar recibos en almacenamiento local
  const locales = obtenerRecibosLocales();
  locales.forEach(r => {
    const n = Number(r.numero_recibo);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });

  // 2. Verificar datos_maestros en Supabase (si tiene permisos)
  try {
    const { data } = await supabase
      .from('datos_maestros')
      .select('orden')
      .eq('tipo', 'RECIBO_CAJA')
      .order('orden', { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].orden) {
      const n = Number(data[0].orden);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  } catch (err) {
    // Silencioso
  }

  // 3. Verificar en tabla cuotas de Supabase
  try {
    let qCuotas = supabase
      .from('cuotas')
      .select('observacion, comprobante_url');
    if (qCuotas && typeof qCuotas.or === 'function') {
      qCuotas = qCuotas.or('observacion.ilike.%Recibo #%,comprobante_url.ilike.%numero_recibo%');
    }
    if (qCuotas && typeof qCuotas.limit === 'function') {
      qCuotas = qCuotas.limit(100);
    }
    const { data: cuotasConRecibos } = await qCuotas;

    if (cuotasConRecibos) {
      cuotasConRecibos.forEach(c => {
        if (c.observacion) {
          const m = c.observacion.match(/Recibo #(\d+)/g);
          if (m) {
            m.forEach(matchStr => {
              const num = parseInt(matchStr.replace('Recibo #', ''), 10);
              if (!isNaN(num) && num > maxNum) maxNum = num;
            });
          }
        }
        if (c.comprobante_url) {
          try {
            const parsed = JSON.parse(c.comprobante_url);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            arr.forEach(item => {
              const n = Number(item.numero_recibo);
              if (!isNaN(n) && n > maxNum) maxNum = n;
            });
          } catch (e) {}
        }
      });
    }
  } catch (e) {
    // Silencioso
  }

  return maxNum + 1;
};

/**
 * Consulta todos los recibos de caja almacenados (unifica Supabase cuotas, datos_maestros y localStorage).
 */
export const obtenerTodosLosRecibos = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && recibosCache && (now - recibosCacheTime < 15000)) {
    return recibosCache;
  }

  const mapaRecibos = new Map();

  // 1. Cargar desde localStorage
  const locales = obtenerRecibosLocales();
  locales.forEach(r => {
    if (r.numero_recibo) {
      mapaRecibos.set(Number(r.numero_recibo), r);
    }
  });

  // 2. Cargar desde cuotas en Supabase (campo comprobante_url)
  try {
    let q = supabase
      .from('cuotas')
      .select('id, venta_id, numero_cuota, comprobante_url, ventas(id, lotes(id_lote), clientes(nombre, doc_cliente))');

    if (q && typeof q.not === 'function') {
      q = q.not('comprobante_url', 'is', null);
    }

    const { data: cuotasConRecibos } = await q;

    if (cuotasConRecibos) {
      cuotasConRecibos.forEach(c => {
        try {
          const parsed = JSON.parse(c.comprobante_url);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          list.forEach(r => {
            if (r && r.numero_recibo) {
              const fullRecibo = {
                lote_id_str: c.ventas?.lotes?.id_lote || r.lote_id_str || '',
                cliente_nombre: c.ventas?.clientes?.nombre || r.cliente_nombre || '',
                cliente_doc: c.ventas?.clientes?.doc_cliente || r.cliente_doc || '',
                venta_id: c.venta_id || r.venta_id,
                cuota_id: c.id || r.cuota_id,
                numero_cuota: c.numero_cuota || r.numero_cuota,
                ...r
              };
              mapaRecibos.set(Number(r.numero_recibo), fullRecibo);
            }
          });
        } catch (e) {}
      });
    }
  } catch (err) {
    console.warn('Aviso cargando recibos desde cuotas:', err);
  }

  // 3. Cargar desde datos_maestros (con graceful fallback)
  try {
    const { data, error } = await supabase
      .from('datos_maestros')
      .select('id, orden, valor, created_at')
      .eq('tipo', 'RECIBO_CAJA')
      .order('orden', { ascending: false });

    if (!error && data) {
      data.forEach(item => {
        try {
          const parsed = typeof item.valor === 'string' ? JSON.parse(item.valor) : item.valor;
          const nr = item.orden || parsed.numero_recibo;
          if (nr) {
            mapaRecibos.set(Number(nr), {
              db_id: item.id,
              numero_recibo: nr,
              ...parsed,
              created_at: parsed.created_at || item.created_at
            });
          }
        } catch (e) {}
      });
    }
  } catch (err) {
    // Silencioso
  }

  const recibos = Array.from(mapaRecibos.values()).sort(
    (a, b) => (Number(b.numero_recibo) || 0) - (Number(a.numero_recibo) || 0)
  );

  recibosCache = recibos;
  recibosCacheTime = now;
  return recibos;
};

/**
 * Obtiene los recibos de un contrato/venta específico.
 */
export const obtenerRecibosPorVenta = async (ventaId) => {
  const todos = await obtenerTodosLosRecibos();
  return todos.filter(r => r.venta_id === ventaId);
};

/**
 * Obtiene los recibos aplicados a una cuota específica.
 */
export const obtenerRecibosPorCuota = async (cuotaId) => {
  const todos = await obtenerTodosLosRecibos();
  return todos.filter(r => r.cuota_id === cuotaId);
};

/**
 * Obtiene los recibos dentro de un rango de fechas de pago.
 */
export const obtenerRecibosEnRango = async (desde, hasta) => {
  const todos = await obtenerTodosLosRecibos();
  return todos.filter(r => {
    const fp = r.fecha_pago || (r.created_at ? r.created_at.slice(0, 10) : null);
    if (!fp) return false;
    return fp >= desde && fp <= hasta;
  });
};

/**
 * Guarda un recibo de caja en memoria/local y en Supabase sin fallar por RLS.
 */
export const crearReciboCaja = async (datosRecibo) => {
  const numero_recibo = datosRecibo.numero_recibo || await obtenerSiguienteNumeroRecibo();
  const valorNum = Math.round(Number(datosRecibo.valor) || 0);
  const valor_letras = datosRecibo.valor_letras || numeroALetrasCOP(valorNum);

  const payload = {
    ...datosRecibo,
    numero_recibo,
    valor: valorNum,
    valor_letras,
    created_at: datosRecibo.created_at || new Date().toISOString()
  };

  // 1. Guardar de forma inmediata en almacenamiento local
  guardarReciboLocal(payload);

  // 2. Intentar guardar en datos_maestros (con graceful fallback si RLS bloquea)
  try {
    const { data, error } = await supabase
      .from('datos_maestros')
      .insert([{
        tipo: 'RECIBO_CAJA',
        orden: numero_recibo,
        valor: JSON.stringify(payload)
      }])
      .select()
      .single();

    if (!error && data) {
      payload.db_id = data.id;
    }
  } catch (err) {
    console.warn('Aviso: guardado en cuota y almacenamiento local (datos_maestros RLS omitido):', err);
  }

  clearRecibosCache();

  return payload;
};

/**
 * Registra un pago/abono a una cuota o contrato, genera el recibo y actualiza el saldo.
 */
export const registrarPagoConRecibo = async ({
  ventaId,
  cuotaId = null,
  monto,
  fechaPago = new Date().toISOString().slice(0, 10),
  medioPago = 'TRANSFERENCIA',
  concepto = '',
  observaciones = '',
  registradoPor = 'Secretaría',
  ciudad = 'Bogotá D.C.',
  loteIdStr = '',
  clienteNombre = '',
  clienteDoc = ''
}) => {
  const montoNum = Math.round(Number(monto) || 0);
  if (montoNum <= 0) {
    throw new Error('El monto a pagar debe ser mayor a cero.');
  }

  // 1. Obtener siguiente número de recibo consecutivo
  const numero_recibo = await obtenerSiguienteNumeroRecibo();

  // 2. Si hay cuota específica, actualizarla en Supabase
  let cuotaActualizada = null;
  let esPagoCompleto = false;
  let saldoRestanteCuota = 0;
  let numeroCuota = null;

  if (cuotaId) {
    const { data: cuota, error: cErr } = await supabase
      .from('cuotas')
      .select('*')
      .eq('id', cuotaId)
      .single();

    if (cErr) throw cErr;

    numeroCuota = cuota.numero_cuota;
    const valCuota = Number(cuota.valor_cuota) || 0;
    const yaPagado = Number(cuota.valor_pagado) || 0;
    const nuevoPagado = yaPagado + montoNum;

    esPagoCompleto = nuevoPagado >= valCuota;
    saldoRestanteCuota = Math.max(0, valCuota - nuevoPagado);

    // Nuevo estado de cuota
    let nuevoEstado = cuota.estado_cuota;
    if (esPagoCompleto) {
      nuevoEstado = 'PAGA';
    } else {
      nuevoEstado = cuota.estado_cuota === 'VENCIDA' ? 'VENCIDA' : 'AL DÍA';
    }

    // Concepto del recibo
    const conceptoFinal = concepto || (
      numeroCuota
        ? `Abono a Cuota #${numeroCuota} lote ${loteIdStr || ''}${esPagoCompleto ? ' (Totalidad)' : ' (Abono Parcial)'}`.trim()
        : `Pago / Abono contrato lote ${loteIdStr || ''}`.trim()
    );

    // Recibo objeto para incrustar en la cuota (comprobante_url)
    const reciboParaCuota = {
      numero_recibo,
      fecha_pago: fechaPago,
      valor: montoNum,
      valor_letras: numeroALetrasCOP(montoNum),
      medio_pago: medioPago,
      concepto: conceptoFinal,
      observaciones: observaciones || '',
      es_pago_completo: esPagoCompleto,
      saldo_restante_cuota: saldoRestanteCuota,
      cliente_nombre: clienteNombre,
      cliente_doc: clienteDoc,
      lote_id_str: loteIdStr,
      venta_id: ventaId,
      cuota_id: cuotaId,
      numero_cuota: numeroCuota,
      ciudad,
      registrado_por: registradoPor,
      created_at: new Date().toISOString()
    };

    // Actualizar historial de recibos dentro de comprobante_url
    let historialRecibos = [];
    if (cuota.comprobante_url) {
      try {
        const parsed = JSON.parse(cuota.comprobante_url);
        if (Array.isArray(parsed)) historialRecibos = parsed;
        else if (parsed && typeof parsed === 'object') historialRecibos = [parsed];
      } catch (e) {}
    }
    historialRecibos.push(reciboParaCuota);

    // Nota de observación con el recibo
    const notaRecibo = `Recibo #${numero_recibo} ($${montoNum.toLocaleString('es-CO')}) el ${fechaPago}`;
    const obsFinal = cuota.observacion
      ? `${cuota.observacion} | ${notaRecibo}`.trim()
      : notaRecibo;

    const { data: cUpdated, error: uErr } = await supabase
      .from('cuotas')
      .update({
        valor_pagado: nuevoPagado,
        estado_cuota: nuevoEstado,
        fecha_pago: fechaPago,
        medio_pago: medioPago,
        observacion: obsFinal,
        comprobante_url: JSON.stringify(historialRecibos)
      })
      .eq('id', cuotaId)
      .select()
      .single();

    if (uErr) throw uErr;
    cuotaActualizada = cUpdated;

    // Verificar si todas las cuotas del contrato están cubiertas
    try {
      const { data: todasCuotas } = await supabase
        .from('cuotas')
        .select('estado_cuota, valor_cuota, valor_pagado')
        .eq('venta_id', ventaId);

      const quedanPendientes = (todasCuotas || []).some(
        c => c.estado_cuota !== 'PAGA' || (Number(c.valor_pagado) || 0) < (Number(c.valor_cuota) || 0)
      );

      if (!quedanPendientes && todasCuotas && todasCuotas.length > 0) {
        await supabase.from('ventas').update({ estado: 'PAGADO EN SU TOTALIDAD' }).eq('id', ventaId);
      }
    } catch (e) {
      console.warn('Aviso verificando saldo total del contrato:', e);
    }
  }

  // 3. Concepto final
  const conceptoFinal = concepto || (
    numeroCuota
      ? `Abono a Cuota #${numeroCuota} lote ${loteIdStr || ''}${esPagoCompleto ? ' (Totalidad)' : ' (Abono Parcial)'}`.trim()
      : `Pago / Abono contrato lote ${loteIdStr || ''}`.trim()
  );

  // 4. Crear el recibo de caja (con fallback seguro que nunca arroja error RLS)
  const reciboEmitido = await crearReciboCaja({
    numero_recibo,
    venta_id: ventaId,
    cuota_id: cuotaId,
    numero_cuota: numeroCuota,
    lote_id_str: loteIdStr,
    cliente_nombre: clienteNombre,
    cliente_doc: clienteDoc,
    ciudad,
    fecha_pago: fechaPago,
    valor: montoNum,
    valor_letras: numeroALetrasCOP(montoNum),
    concepto: conceptoFinal,
    medio_pago: medioPago,
    observaciones: observaciones || '',
    es_pago_completo: esPagoCompleto,
    saldo_restante_cuota: saldoRestanteCuota,
    registrado_por: registradoPor
  });

  // 5. Registrar en Log de Auditoría
  try {
    await registrarAccion({
      modulo: 'RECIBOS_CAJA',
      accion: 'EMISION_RECIBO_PAGO',
      lote_id_str: loteIdStr || `Venta #${ventaId}`,
      descripcion: `Emisión de Recibo de Caja #${numero_recibo} por $${montoNum.toLocaleString('es-CO')} (${conceptoFinal}) a nombre de ${clienteNombre || 'Cliente'}`
    });
  } catch (errLog) {
    console.warn('Aviso registrando auditoría de recibo:', errLog);
  }

  return {
    recibo: reciboEmitido,
    cuotaActualizada
  };
};
