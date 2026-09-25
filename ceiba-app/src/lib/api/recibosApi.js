import { supabase } from '../supabase';
import { numeroALetrasCOP } from '../../utils/numeroALetras';
import { registrarAccion } from './auditApi';

const CONSECUTIVO_INICIAL = 3175;

// Cache en memoria para recibos (TTL 30s)
let recibosCache = null;
let recibosCacheTime = 0;

export const clearRecibosCache = () => {
  recibosCache = null;
  recibosCacheTime = 0;
};

/**
 * Obtiene el siguiente número de recibo autoincrementable.
 * Inicia en 3175 si no existen recibos previos.
 */
export const obtenerSiguienteNumeroRecibo = async () => {
  try {
    const { data, error } = await supabase
      .from('datos_maestros')
      .select('orden')
      .eq('tipo', 'RECIBO_CAJA')
      .order('orden', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Error consultando consecutivo en Supabase, usando cálculo local:', error);
      return CONSECUTIVO_INICIAL;
    }

    if (data && data.length > 0 && data[0].orden) {
      return Math.max(CONSECUTIVO_INICIAL - 1, Number(data[0].orden)) + 1;
    }

    return CONSECUTIVO_INICIAL;
  } catch (err) {
    console.error('Error obteniendo consecutivo de recibo:', err);
    return CONSECUTIVO_INICIAL;
  }
};

/**
 * Consulta todos los recibos de caja almacenados.
 */
export const obtenerTodosLosRecibos = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && recibosCache && (now - recibosCacheTime < 30000)) {
    return recibosCache;
  }

  try {
    const { data, error } = await supabase
      .from('datos_maestros')
      .select('id, orden, valor, created_at')
      .eq('tipo', 'RECIBO_CAJA')
      .order('orden', { ascending: false });

    if (error) throw error;

    const recibos = (data || []).map(item => {
      try {
        const parsed = typeof item.valor === 'string' ? JSON.parse(item.valor) : item.valor;
        return {
          db_id: item.id,
          numero_recibo: item.orden || parsed.numero_recibo,
          ...parsed,
          created_at: parsed.created_at || item.created_at,
        };
      } catch (e) {
        return {
          db_id: item.id,
          numero_recibo: item.orden,
          valor: 0,
          error: 'Formato inválido'
        };
      }
    });

    recibosCache = recibos;
    recibosCacheTime = now;
    return recibos;
  } catch (err) {
    console.error('Error cargando recibos de caja:', err);
    return recibosCache || [];
  }
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
 * Guarda un recibo de caja en la base de datos.
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

  const { data, error } = await supabase
    .from('datos_maestros')
    .insert([{
      tipo: 'RECIBO_CAJA',
      orden: numero_recibo,
      valor: JSON.stringify(payload)
    }])
    .select()
    .single();

  if (error) throw error;

  clearRecibosCache();

  return {
    db_id: data.id,
    ...payload
  };
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
      // Si aún no está completa, no se marca PAGA
      // Se mantiene en AL DÍA o POR VENCER según corresponda
      nuevoEstado = cuota.estado_cuota === 'VENCIDA' ? 'VENCIDA' : 'AL DÍA';
    }

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
        observacion: obsFinal
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

  // 3. Concepto por defecto si viene vacío
  const conceptoFinal = concepto || (
    numeroCuota
      ? `Abono a Cuota #${numeroCuota} lote ${loteIdStr || ''}${esPagoCompleto ? ' (Totalidad)' : ' (Abono Parcial)'}`.trim()
      : `Pago / Abono contrato lote ${loteIdStr || ''}`.trim()
  );

  // 4. Crear el recibo de caja
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
