import { supabase } from '../supabase';

export const getCuotasByVenta = async (ventaId) => {
  const { data, error } = await supabase
    .from('cuotas')
    .select('*')
    .eq('venta_id', ventaId)
    .order('numero_cuota', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getCuotas = async ({ estado, idLote, search } = {}) => {
  let query = supabase
    .from('cuotas')
    .select(`
      *,
      ventas (
        id, precio_venta, valor_cuota, dias_pago, vendedor_nombre,
        lotes (id_lote),
        clientes (nombre, celular)
      )
    `)
    .order('fecha_vencimiento', { ascending: true });

  if (estado && estado !== 'Todos') query = query.eq('estado_cuota', estado);

  const { data, error } = await query;
  if (error) throw error;

  if (search || idLote) {
    const s = (search || idLote || '').toLowerCase();
    return data.filter(c =>
      c.ventas?.lotes?.id_lote?.toLowerCase().includes(s) ||
      c.ventas?.clientes?.nombre?.toLowerCase().includes(s)
    );
  }
  return data || [];
};

/**
 * Simulación previa de imputación en cascada de un abono
 */
export const simularAbonoCascada = (cuotas = [], montoTotal = 0) => {
  let montoRestante = Math.max(0, Number(montoTotal) || 0);
  const lista = Array.isArray(cuotas) ? cuotas : [];
  const pendientes = lista
    .filter(c => c && (c.estado_cuota !== 'PAGA' || (Number(c.valor_pagado) || 0) < (Number(c.valor_cuota) || 0)))
    .sort((a, b) => (Number(a?.numero_cuota) || 0) - (Number(b?.numero_cuota) || 0));

  const afectaciones = [];

  for (const c of pendientes) {
    if (montoRestante <= 0) break;

    const valCuota = Number(c.valor_cuota) || 0;
    const yaPagado = Number(c.valor_pagado) || 0;
    const porPagar = Math.max(0, valCuota - yaPagado);

    if (porPagar <= 0 && valCuota > 0) continue;

    if (montoRestante >= porPagar) {
      afectaciones.push({
        id: c.id,
        numero_cuota: c.numero_cuota,
        fecha_vencimiento: c.fecha_vencimiento,
        valor_cuota: valCuota,
        valor_anterior: yaPagado,
        valor_abono: porPagar,
        nuevo_pagado: valCuota,
        nuevo_estado: 'PAGA',
        completo: true
      });
      montoRestante -= porPagar;
    } else {
      afectaciones.push({
        id: c.id,
        numero_cuota: c.numero_cuota,
        fecha_vencimiento: c.fecha_vencimiento,
        valor_cuota: valCuota,
        valor_anterior: yaPagado,
        valor_abono: montoRestante,
        nuevo_pagado: yaPagado + montoRestante,
        nuevo_estado: 'AL DÍA', // Abono parcial registrado
        completo: false
      });
      montoRestante = 0;
    }
  }

  return {
    afectaciones,
    montoAplicado: Number(montoTotal) - montoRestante,
    montoSobrante: montoRestante
  };
};

/**
 * Registro de abono con imputación automática en cascada
 */
export const registrarAbonoCascada = async ({
  ventaId,
  monto,
  fechaPago,
  medioPago,
  observacion,
  esPagoMultiple = false,
  mesMultiple = null,
  comprobante = null
}) => {
  if (!ventaId) throw new Error('Se requiere ventaId para abonar');
  const montoNum = Number(monto);
  if (!montoNum || montoNum <= 0) throw new Error('El monto a abonar debe ser mayor a 0');

  // 1. Obtener todas las cuotas de la venta ordenadas cronológicamente
  const cuotas = await getCuotasByVenta(ventaId);
  const { afectaciones, montoSobrante } = simularAbonoCascada(cuotas, montoNum);

  if (afectaciones.length === 0) {
    throw new Error('No hay cuotas pendientes para liquidar en este contrato');
  }

  // 2. Subir comprobante si existe
  let comprobanteUrl = null;
  if (comprobante) {
    try {
      const ext = comprobante.name.split('.').pop();
      const path = `abonos/${ventaId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(path, comprobante, { upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path);
        comprobanteUrl = urlData.publicUrl;
      }
    } catch (e) {
      console.warn('No se pudo subir comprobante:', e);
    }
  }

  // 3. Determinar fecha y nota final
  const fechaFinal = esPagoMultiple ? null : (fechaPago || new Date().toISOString().slice(0, 10));
  let obsBase = observacion ? observacion.trim() : '';

  // 4. Actualizar cuotas afectadas en Supabase según la nueva regla:
  // Si el abono cubre múltiples cuotas (afectaciones.length > 1), el monto completo y la fecha
  // se registran exclusivamente en la primera cuota, y las siguientes cuotas quedan marcadas
  // como PAGA con valor $0 y sin fecha de pago falsa.
  const esAbonoMultiplesCuotas = afectaciones.length > 1;
  const primeraAfectada = afectaciones[0];
  const ultimaAfectada = afectaciones[afectaciones.length - 1];
  const proximaCuotaNum = ultimaAfectada.numero_cuota + 1;
  const proximaCuotaObj = cuotas.find(c => c.numero_cuota === proximaCuotaNum);
  const proximaFechaStr = proximaCuotaObj?.fecha_vencimiento || '';

  // Nota explicativa automática
  let notaAutoAbono = '';
  if (esAbonoMultiplesCuotas) {
    if (proximaCuotaObj) {
      notaAutoAbono = `Abono extraordinario de $${montoNum.toLocaleString('es-CO')} cubre ${afectaciones.length} cuotas (cuotas ${primeraAfectada.numero_cuota} a ${ultimaAfectada.numero_cuota}) - Próximo aporte: cuota ${proximaCuotaNum}${proximaFechaStr ? ` (${proximaFechaStr})` : ''}`;
    } else {
      notaAutoAbono = `Abono extraordinario de $${montoNum.toLocaleString('es-CO')} salda hasta cuota ${ultimaAfectada.numero_cuota} (contrato saldado en su totalidad)`;
    }
  }

  for (let i = 0; i < afectaciones.length; i++) {
    const a = afectaciones[i];
    const cuotaOrig = cuotas.find(c => c.id === a.id);

    let valPagadoFinal;
    let fechaPagoFinal;
    let obsFinal;

    if (i === 0) {
      // Primera cuota: recibe el monto total del abono
      valPagadoFinal = esAbonoMultiplesCuotas ? montoNum : a.nuevo_pagado;
      fechaPagoFinal = fechaFinal;
      const partesObs = [];
      if (notaAutoAbono) partesObs.push(notaAutoAbono);
      if (obsBase) partesObs.push(obsBase);
      if (!a.completo && !esAbonoMultiplesCuotas) {
        partesObs.push(`Abono parcial: $${a.valor_abono.toLocaleString('es-CO')}`);
      }
      obsFinal = partesObs.join(' | ') || cuotaOrig?.observacion || null;
    } else {
      // Cuotas subsecuentes: quedan limpias como PAGA ($0 y sin fecha falsa)
      valPagadoFinal = 0.0;
      fechaPagoFinal = null;
      obsFinal = null;
    }

    const { error: updateError } = await supabase
      .from('cuotas')
      .update({
        valor_pagado: valPagadoFinal,
        estado_cuota: 'PAGA',
        fecha_pago: fechaPagoFinal,
        medio_pago: medioPago || cuotaOrig?.medio_pago || 'TRANSFERENCIA',
        comprobante_url: (i === 0) ? (comprobanteUrl || cuotaOrig?.comprobante_url) : null,
        observacion: obsFinal,
      })
      .eq('id', a.id);

    if (updateError) throw updateError;
  }

  // 5. Verificar si todas las cuotas del contrato quedaron pagadas
  const todasCuotas = await getCuotasByVenta(ventaId);
  const quedanPendientes = todasCuotas.some(c => c.estado_cuota !== 'PAGA' || (Number(c.valor_pagado) || 0) < (Number(c.valor_cuota) || 0));

  let marcadoPagadoTotal = false;
  if (!quedanPendientes && todasCuotas.length > 0) {
    try {
      const { data: vData } = await supabase.from('ventas').select('lote_id').eq('id', ventaId).single();
      await supabase.from('ventas').update({ estado: 'PAGADO EN SU TOTALIDAD' }).eq('id', ventaId);
      if (vData?.lote_id) {
        // En Postgres la tabla lotes acepta 'VENDIDO' para lotes con ventas
        await supabase.from('lotes').update({ estado: 'VENDIDO' }).eq('id', vData.lote_id);
      }
      marcadoPagadoTotal = true;
    } catch (e) {
      console.warn('Advertencia actualizando estado a PAGADO EN SU TOTALIDAD:', e);
    }
  }

  return {
    success: true,
    cuotasAfectadas: afectaciones.length,
    montoAplicado: montoNum - montoSobrante,
    montoSobrante,
    marcadoPagadoTotal
  };
};


/**
 * Actualización manual directa de una cuota individual
 */
export const actualizarCuotaManual = async (cuotaId, updates) => {
  const { data, error } = await supabase
    .from('cuotas')
    .update(updates)
    .eq('id', cuotaId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Registro de pago simple por cuota individual
 */
export const registrarPago = async ({ cuotaId, fechaPago, valorPagado, medioPago, comprobante }) => {
  let comprobanteUrl = null;

  if (comprobante) {
    const ext  = comprobante.name.split('.').pop();
    const path = `cuotas/${cuotaId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(path, comprobante, { upsert: true });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path);
      comprobanteUrl = urlData.publicUrl;
    }
  }

  const { data, error } = await supabase
    .from('cuotas')
    .update({
      fecha_pago:      fechaPago,
      valor_pagado:    valorPagado,
      medio_pago:      medioPago,
      estado_cuota:    'PAGA',
      comprobante_url: comprobanteUrl,
    })
    .eq('id', cuotaId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getResumenCartera = async () => {
  const { data, error } = await supabase
    .from('v_cartera_total')
    .select('*');
  if (error) throw error;
  return data || [];
};
