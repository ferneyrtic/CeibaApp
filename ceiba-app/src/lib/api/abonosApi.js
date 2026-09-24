import { supabase } from '../supabase';

/**
 * Detecta contratos donde el último pago registrado es un abono extraordinario
 * (valor pagado >= 2x el valor estándar de la cuota).
 *
 * Para cada caso detectado, calcula:
 * - Cuántas cuotas cubre el abono.
 * - Cuáles cuotas siguientes (no pagadas) serían amortizadas.
 * - Preview de la amortización (qué cambiaría si se aplica).
 *
 * @returns {Array} Lista de casos de abono extraordinario
 */
export async function detectarAbonosExtraordinarios() {
  let cuotas = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('cuotas')
      .select(`
        id, venta_id, numero_cuota,
        fecha_vencimiento, fecha_pago,
        valor_cuota, valor_pagado,
        estado_cuota, medio_pago, observacion,
        ventas(
          id, valor_cuota, saldo_financiado, plazo_cuotas, lote_id, estado,
          lotes(id, id_lote, manzana, lote, estado),
          clientes(nombre, doc_cliente, celular)
        )
      `)

      .order('id')
      .range(from, from + batchSize - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      cuotas.push(...data);
    }
    if (!data || data.length < batchSize) break;
    from += batchSize;
  }


  // Agrupar por venta_id
  const byVenta = {};
  for (const c of (cuotas || [])) {
    if (!byVenta[c.venta_id]) byVenta[c.venta_id] = [];
    byVenta[c.venta_id].push(c);
  }

  const today = new Date().toISOString().slice(0, 10);
  const casos = [];

  for (const [ventaId, cuotasVenta] of Object.entries(byVenta)) {
    // Cuotas con pago real registrado (valor > 0)
    const pagadas = cuotasVenta
      .filter(c => c.fecha_pago && Number(c.valor_pagado) > 0)
      .sort((a, b) => a.numero_cuota - b.numero_cuota);

    if (!pagadas.length) continue;

    const ultimaPagada = pagadas[pagadas.length - 1];
    const venta = ultimaPagada.ventas;
    if (!venta) continue;

    // Valor estándar de la cuota (desde ventas o desde las cuotas mismas)
    const valorCuotaEstandar =
      Number(venta.valor_cuota) ||
      Number(ultimaPagada.valor_cuota) ||
      0;

    if (valorCuotaEstandar <= 0) continue;

    const valorPagado = Number(ultimaPagada.valor_pagado);
    const cuotasQueCubre = valorPagado / valorCuotaEstandar;

    // Solo interesa si cubre >= 2 cuotas
    if (cuotasQueCubre < 2) continue;

    const cuotasEnterass = Math.floor(cuotasQueCubre);
    const remanente = valorPagado - (cuotasEnterass * valorCuotaEstandar);

    // Cuotas siguientes no pagadas que serían amortizadas
    const siguienteNum = ultimaPagada.numero_cuota + 1;
    const plazo = Number(venta.plazo_cuotas) || cuotasVenta.length;

    // Cuotas pendientes (sin fecha_pago) después de la última pagada
    const pendientes = cuotasVenta
      .filter(c => c.numero_cuota >= siguienteNum && !c.fecha_pago)
      .sort((a, b) => a.numero_cuota - b.numero_cuota)
      .slice(0, cuotasEnterass - 1); // -1 porque la última pagada YA cuenta como la primera

    // Preview de amortización
    const amortizaciones = pendientes.map((c, i) => {
      const esUltima = i === pendientes.length - 1;
      const valorAmortizado = esUltima && remanente > 0 ? 0.0 : 0.0; // valor_pagado = 0 (amortizado)
      return {
        cuota_id: c.id,
        numero_cuota: c.numero_cuota,
        fecha_vencimiento: c.fecha_vencimiento,
        estado_actual: c.estado_cuota,
        valor_cuota: Number(c.valor_cuota),
        valor_pagado_nuevo: 0.0,
        fecha_pago_nueva: ultimaPagada.fecha_pago, // misma fecha que el abono
        estado_nuevo: 'PAGA',
        observacion_nueva: `Amortizada por abono extraordinario de $${valorPagado.toLocaleString('es-CO')} del ${ultimaPagada.fecha_pago}`
      };
    });

    const lote = venta.lotes?.id_lote || '—';
    const loteId = venta.lotes?.id || venta.lote_id;
    const loteEstado = venta.lotes?.estado || 'VENDIDO';
    const cliente = venta.clientes?.nombre || '—';
    const cedula = venta.clientes?.doc_cliente || '—';

    // Cuotas pendientes sin pagar en este contrato
    const cuotasPendientesSinPagar = cuotasVenta.filter(c => !c.fecha_pago || c.estado_cuota !== 'PAGA');
    const cubreTotalidad = amortizaciones.length >= cuotasPendientesSinPagar.length && cuotasPendientesSinPagar.length > 0;

    casos.push({
      venta_id: ventaId,
      id_lote: lote,
      lote_id: loteId,
      lote_estado_actual: loteEstado,
      venta_estado_actual: venta.estado || 'VENDIDO',
      total_pendientes_contrato: cuotasPendientesSinPagar.length,
      cubre_totalidad_sugerido: cubreTotalidad,
      cliente,
      cedula,
      ultima_cuota_num: ultimaPagada.numero_cuota,
      ultima_cuota_id: ultimaPagada.id,
      fecha_pago: ultimaPagada.fecha_pago,
      valor_pagado: valorPagado,
      valor_cuota_estandar: valorCuotaEstandar,
      cuotas_que_cubre: cuotasQueCubre,
      cuotas_enteras: cuotasEnterass,
      remanente,
      plazo_total: plazo,
      cuotas_pendientes_amortizar: amortizaciones,
      observacion_actual: ultimaPagada.observacion || null,
      observacion_sugerida:
        `Pago grande: cubre ~${cuotasEnterass} cuotas. Val: $${valorPagado.toLocaleString('es-CO')}. Fecha: ${ultimaPagada.fecha_pago}`,
      nivel:
        cuotasQueCubre >= 6 ? 'critico' :
        cuotasQueCubre >= 3 ? 'alto' : 'moderado'
    });

  }

  return casos.sort((a, b) => b.cuotas_que_cubre - a.cuotas_que_cubre);
}

/**
 * Aplica la amortización de cuotas en Supabase para un caso de abono extraordinario.
 * Actualiza las cuotas pendientes a PAGA con valor_pagado = 0 y observación.
 * También agrega la observación a la cuota del abono grande.
 * Si marcarPagadoTotal es true, actualiza el estado del lote y venta a "PAGADO EN SU TOTALIDAD".
 */
export async function aplicarAmortizacion(caso, customOptions = {}) {
  const {
    cuotasParaAmortizar = caso.cuotas_pendientes_amortizar,
    observacionPrincipal = caso.observacion_sugerida,
    marcarPagadoTotal = false
  } = customOptions;

  const ops = [];

  // 1. Actualizar cada cuota a PAGA
  for (const am of (cuotasParaAmortizar || [])) {
    ops.push(
      supabase
        .from('cuotas')
        .update({
          estado_cuota: 'PAGA',
          valor_pagado: 0.0,
          fecha_pago: am.fecha_pago_nueva,
          observacion: am.observacion_nueva
        })
        .eq('id', am.cuota_id)
    );
  }

  // 2. Actualizar la observación en la cuota del abono grande
  if (observacionPrincipal !== undefined) {
    ops.push(
      supabase
        .from('cuotas')
        .update({ observacion: observacionPrincipal || null })
        .eq('id', caso.ultima_cuota_id)
    );
  }

  // 3. Si se solicita marcar como PAGADO EN SU TOTALIDAD:
  // Nota: La tabla 'lotes' de Postgres tiene un CHECK constraint que acepta 'VENDIDO',
  // mientras que 'ventas' almacena 'PAGADO EN SU TOTALIDAD'.
  if (marcarPagadoTotal) {
    if (caso.lote_id) {
      ops.push(
        supabase
          .from('lotes')
          .update({ estado: 'VENDIDO' })
          .eq('id', caso.lote_id)
      );
    }
    if (caso.venta_id) {
      ops.push(
        supabase
          .from('ventas')
          .update({ estado: 'PAGADO EN SU TOTALIDAD' })
          .eq('id', caso.venta_id)
      );
    }
  }

  const results = await Promise.all(ops);
  for (const r of results) {
    if (r.error) throw r.error;
  }

  return {
    cuotas_amortizadas: (cuotasParaAmortizar || []).length,
    observacion_aplicada: observacionPrincipal,
    marcado_pagado_total: marcarPagadoTotal
  };
}



/**
 * Guarda/actualiza la observación de una cuota específica.
 */
export async function guardarObservacionCuota(cuotaId, observacion) {
  const { error } = await supabase
    .from('cuotas')
    .update({ observacion: observacion || null })
    .eq('id', cuotaId);

  if (error) throw error;
  return true;
}
