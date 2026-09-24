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
export const simularAbonoCascada = (cuotas, montoTotal) => {
  let montoRestante = Math.max(0, Number(montoTotal) || 0);
  const pendientes = [...cuotas]
    .filter(c => c.estado_cuota !== 'PAGA' || (c.valor_pagado || 0) < (c.valor_cuota || 0))
    .sort((a, b) => a.numero_cuota - b.numero_cuota);

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
  if (esPagoMultiple && mesMultiple) {
    obsBase = `PAGO MÚLTIPLE - ${mesMultiple.toUpperCase()}${obsBase ? ' | ' + obsBase : ''}`;
  }

  // 4. Actualizar cuotas afectadas en Supabase
  for (const a of afectaciones) {
    const cuotaOrig = cuotas.find(c => c.id === a.id);
    let obsCuota = obsBase;
    if (cuotaOrig?.observacion) {
      obsCuota = `${cuotaOrig.observacion} | ${obsBase}`.trim();
    }
    if (!a.completo) {
      obsCuota += ` (Abono parcial: $${a.valor_abono.toLocaleString('es-CO')})`;
    }

    const { error: updateError } = await supabase
      .from('cuotas')
      .update({
        valor_pagado: a.nuevo_pagado,
        estado_cuota: a.nuevo_estado,
        fecha_pago: fechaFinal,
        medio_pago: medioPago || cuotaOrig?.medio_pago || 'TRANSFERENCIA',
        comprobante_url: comprobanteUrl || cuotaOrig?.comprobante_url,
        observacion: obsCuota.trim() || null,
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
