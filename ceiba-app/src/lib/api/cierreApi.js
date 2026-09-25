import { supabase } from '../supabase';
import { obtenerRecibosEnRango } from './recibosApi';

// Cache en memoria por periodo para navegación instantánea
let cierreCache = {};
let cierreCacheTime = {};

export const clearCierreCache = () => {
  cierreCache = {};
  cierreCacheTime = {};
};

/**
 * Consulta y consolida todos los recaudos reales del período por Fecha de Pago (Flujo de Caja)
 * @param {string} fechaDesde - Fecha inicio en formato 'YYYY-MM-DD'
 * @param {string} fechaHasta - Fecha fin en formato 'YYYY-MM-DD'
 * @param {boolean} forceRefresh - Forzar recarga sin usar caché
 */
export const getCierreMensualData = async (param1, param2, forceRefresh = false) => {
  let fechaDesde = param1;
  let fechaHasta = param2;

  // Si se pasan año y mes como números o strings numéricos sin guion (ej. 2026, 9)
  if (param1 && !String(param1).includes('-')) {
    const yNum = Number(param1);
    const mNum = Number(param2);
    const mStr = String(mNum).padStart(2, '0');
    const lastDay = new Date(yNum, mNum, 0).getDate();
    fechaDesde = `${yNum}-${mStr}-01`;
    fechaHasta = `${yNum}-${mStr}-${String(lastDay).padStart(2, '0')}`;
  }

  const periodKey = `${fechaDesde}_${fechaHasta}`;
  const now = Date.now();

  // Cache de 45 segundos si no se solicita refresco forzado
  if (!forceRefresh && cierreCache[periodKey] && (now - (cierreCacheTime[periodKey] || 0) < 45000)) {
    return cierreCache[periodKey];
  }

  // 1. Consultar en paralelo Cuotas, Cuotas Iniciales y Recibos Oficiales en el rango
  const [cuotasRes, inicialesRes, recibosRango] = await Promise.all([
    supabase
      .from('cuotas')
      .select(`
        id, venta_id, numero_cuota, fecha_vencimiento, fecha_pago,
        valor_cuota, valor_pagado, estado_cuota, medio_pago, comprobante_url, observacion,
        ventas (
          id, vendedor_nombre,
          lotes (id_lote, manzana, lote, etapa),
          clientes (id, nombre, celular, doc_cliente, ciudad)
        )
      `)
      .gte('fecha_pago', fechaDesde)
      .lte('fecha_pago', fechaHasta)
      .order('fecha_pago', { ascending: true }),

    supabase
      .from('ventas')
      .select(`
        id, fecha_venta, precio_venta, valor_cuota_inicial, fecha_pago_cuota_inicial,
        medio_pago, vendedor_nombre, saldo_financiado, plazo_cuotas, valor_cuota,
        lotes (id_lote, manzana, lote, etapa),
        clientes (id, nombre, celular, doc_cliente, ciudad)
      `)
      .gte('fecha_pago_cuota_inicial', fechaDesde)
      .lte('fecha_pago_cuota_inicial', fechaHasta)
      .order('fecha_pago_cuota_inicial', { ascending: true }),

    obtenerRecibosEnRango(fechaDesde, fechaHasta).catch(() => [])
  ]);

  if (cuotasRes.error) throw cuotasRes.error;
  if (inicialesRes.error) throw inicialesRes.error;

  const rawCuotas = cuotasRes.data || [];
  const rawIniciales = inicialesRes.data || [];
  const rawRecibos = Array.isArray(recibosRango) ? recibosRango : [];

  // Mapear IDs de cuotas que tienen recibos emitidos para evitar duplicados
  const recibosCuotaIds = new Set(rawRecibos.filter(r => r.cuota_id).map(r => r.cuota_id));

  // 2. Normalizar y Unificar en Lista de Ingresos Efectivos
  const cuotasMesLegacy = rawCuotas
    .filter(c => !recibosCuotaIds.has(c.id))
    .map(c => {
      const valor = c.valor_pagado !== null && c.valor_pagado !== undefined
        ? Number(c.valor_pagado)
        : (Number(c.valor_cuota) || 0);
      return {
        id: `cuota-${c.id}`,
        rawId: c.id,
        tipo: 'CUOTA_MENSUAL',
        tipoLabel: 'Cuota Mensual',
        concepto: `Cuota #${c.numero_cuota}`,
        numero_cuota: c.numero_cuota,
        fecha_pago: c.fecha_pago,
        fecha_vencimiento: c.fecha_vencimiento,
        valor,
        medio_pago: c.medio_pago || 'Transferencia',
        lote: c.ventas?.lotes?.id_lote || '—',
        cliente: c.ventas?.clientes?.nombre || '—',
        doc_cliente: c.ventas?.clientes?.doc_cliente || '—',
        celular: c.ventas?.clientes?.celular || '—',
        vendedor: c.ventas?.vendedor_nombre || 'Sin Asesor',
        comprobante_url: c.comprobante_url,
        observacion: c.observacion || '',
        venta_id: c.venta_id,
      };
    })
    .filter(c => c.valor > 0);

  // Recibos Oficiales emitidos en el período (maneja pagos parciales exactos por día)
  const recibosIngresos = rawRecibos.map(r => {
    const valor = Number(r.valor) || 0;
    return {
      id: `recibo-${r.numero_recibo}`,
      rawId: r.cuota_id || r.venta_id,
      tipo: 'CUOTA_MENSUAL',
      tipoLabel: r.es_pago_completo ? 'Cuota Mensual' : 'Abono Parcial (Recibo)',
      concepto: r.concepto || (r.numero_cuota ? `Cuota #${r.numero_cuota}` : 'Abono'),
      numero_cuota: r.numero_cuota || 0,
      fecha_pago: r.fecha_pago,
      fecha_vencimiento: r.fecha_pago,
      valor,
      medio_pago: r.medio_pago || 'Transferencia',
      lote: r.lote_id_str || '—',
      cliente: r.cliente_nombre || '—',
      doc_cliente: r.cliente_doc || '—',
      celular: '—',
      vendedor: r.vendedor_nombre || 'Secretaría',
      comprobante_url: null,
      observacion: `Recibo Oficial #${r.numero_recibo}${r.observaciones ? ' | ' + r.observaciones : ''}`,
      venta_id: r.venta_id,
      numero_recibo: r.numero_recibo
    };
  }).filter(r => r.valor > 0);

  const cuotasMes = [...cuotasMesLegacy, ...recibosIngresos];

  const inicialesMes = rawIniciales
    .map(v => {
      const valor = Number(v.valor_cuota_inicial) || 0;
      return {
        id: `inicial-${v.id}`,
        rawId: v.id,
        tipo: 'CUOTA_INICIAL',
        tipoLabel: 'Cuota Inicial',
        concepto: 'Cuota Inicial',
        numero_cuota: 0,
        fecha_pago: v.fecha_pago_cuota_inicial,
        fecha_vencimiento: v.fecha_venta || v.fecha_pago_cuota_inicial,
        valor,
        medio_pago: v.medio_pago || 'Transferencia',
        lote: v.lotes?.id_lote || '—',
        cliente: v.clientes?.nombre || '—',
        doc_cliente: v.clientes?.doc_cliente || '—',
        celular: v.clientes?.celular || '—',
        vendedor: v.vendedor_nombre || 'Sin Asesor',
        observacion: `Venta lote ${v.lotes?.id_lote || ''}`,
        venta_id: v.id,
      };
    })
    .filter(v => v.valor > 0);

  // Lista consolidada cronológica
  const todosIngresos = [...cuotasMes, ...inicialesMes].sort((a, b) => {
    if (a.fecha_pago === b.fecha_pago) {
      return a.lote.localeCompare(b.lote);
    }
    return (a.fecha_pago || '').localeCompare(b.fecha_pago || '');
  });

  // 3. Métricas Financieras (KPIs)
  const totalCuotasMes = cuotasMes.reduce((acc, c) => acc + c.valor, 0);
  const countCuotasMes = cuotasMes.length;

  const totalInicialesMes = inicialesMes.reduce((acc, i) => acc + i.valor, 0);
  const countInicialesMes = inicialesMes.length;

  const totalRecaudadoMes = totalCuotasMes + totalInicialesMes;
  const totalTransacciones = todosIngresos.length;
  const ticketPromedio = totalTransacciones > 0 ? Math.round(totalRecaudadoMes / totalTransacciones) : 0;

  // 4. Ranking y Desglose por Asesor Comercial
  const asesorMap = {};
  todosIngresos.forEach(item => {
    const vend = item.vendedor || 'Sin Asesor';
    if (!asesorMap[vend]) {
      asesorMap[vend] = {
        vendedor: vend,
        totalRecaudado: 0,
        totalCuotas: 0,
        countCuotas: 0,
        totalIniciales: 0,
        countIniciales: 0,
        totalTransacciones: 0,
        lotes: new Set(),
      };
    }
    asesorMap[vend].totalRecaudado += item.valor;
    asesorMap[vend].totalTransacciones++;
    asesorMap[vend].lotes.add(item.lote);
    if (item.tipo === 'CUOTA_MENSUAL') {
      asesorMap[vend].totalCuotas += item.valor;
      asesorMap[vend].countCuotas++;
    } else {
      asesorMap[vend].totalIniciales += item.valor;
      asesorMap[vend].countIniciales++;
    }
  });

  const rankingAsesores = Object.values(asesorMap)
    .map(a => ({
      ...a,
      lotesCount: a.lotes.size,
      pctDelTotal: totalRecaudadoMes > 0 ? (a.totalRecaudado / totalRecaudadoMes) * 100 : 0,
    }))
    .sort((a, b) => b.totalRecaudado - a.totalRecaudado);

  // 5. Desglose por Medios de Pago
  const medioMap = {};
  todosIngresos.forEach(item => {
    const m = (item.medio_pago || 'Transferencia').toUpperCase().trim();
    if (!medioMap[m]) {
      medioMap[m] = { medio: m, total: 0, count: 0 };
    }
    medioMap[m].total += item.valor;
    medioMap[m].count++;
  });

  const desgloseMedios = Object.values(medioMap)
    .map(m => ({
      ...m,
      pct: totalRecaudadoMes > 0 ? (m.total / totalRecaudadoMes) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // 6. Recaudo por Día del Rango
  const diaMap = {};
  let cur = new Date(fechaDesde + 'T12:00:00');
  const end = new Date(fechaHasta + 'T12:00:00');
  while (cur <= end) {
    const fStr = cur.toISOString().slice(0, 10);
    diaMap[fStr] = { dia: cur.getDate(), fecha: fStr, cuotasMonto: 0, inicialesMonto: 0, totalDia: 0, count: 0 };
    cur.setDate(cur.getDate() + 1);
  }

  todosIngresos.forEach(item => {
    if (item.fecha_pago && diaMap[item.fecha_pago]) {
      diaMap[item.fecha_pago].totalDia += item.valor;
      diaMap[item.fecha_pago].count++;
      if (item.tipo === 'CUOTA_MENSUAL') {
        diaMap[item.fecha_pago].cuotasMonto += item.valor;
      } else {
        diaMap[item.fecha_pago].inicialesMonto += item.valor;
      }
    }
  });

  const recaudoPorDia = Object.values(diaMap);

  // 7. Detección de Lotes Saldados en el período
  let saldadosRes = { data: [] };
  try {
    const qVentas = supabase
      .from('ventas')
      .select(`
        id, precio_venta, valor_cuota_inicial, fecha_pago_cuota_inicial,
        saldo, estado, vendedor_nombre,
        lotes (id_lote),
        clientes (nombre, doc_cliente),
        cuotas (id, fecha_pago, valor_pagado)
      `);
    if (qVentas && typeof qVentas.in === 'function') {
      saldadosRes = await qVentas.in('estado', ['PAGADO EN SU TOTALIDAD', 'SALDADO', 'PAGADO']);
    }
  } catch (err) {
    console.warn('Error consultando lotes saldados:', err);
  }

  const lotesCompletamentePagados = (saldadosRes.data || []).filter(v => {
    const fechas = (v.cuotas || []).filter(c => c.fecha_pago).map(c => c.fecha_pago);
    if (v.fecha_pago_cuota_inicial) fechas.push(v.fecha_pago_cuota_inicial);
    if (!fechas.length) return false;
    const ultimo = fechas.sort().at(-1);
    return ultimo >= fechaDesde && ultimo <= fechaHasta;
  }).map(v => {
    const totalCuotas = (v.cuotas || []).reduce((a, c) => a + (Number(c.valor_pagado) || 0), 0);
    const totalPagado = totalCuotas + (Number(v.valor_cuota_inicial) || 0);
    const fechas = (v.cuotas || []).filter(c => c.fecha_pago).map(c => c.fecha_pago);
    if (v.fecha_pago_cuota_inicial) fechas.push(v.fecha_pago_cuota_inicial);
    const ultimoPago = fechas.sort().at(-1);
    return {
      id: v.id,
      lote: v.lotes?.id_lote || '—',
      cliente: v.clientes?.nombre || '—',
      doc_cliente: v.clientes?.doc_cliente || '—',
      precio_total: Number(v.precio_venta) || 0,
      total_pagado: totalPagado,
      fecha_ultimo_pago: ultimoPago,
      vendedor: v.vendedor_nombre || 'Sin Asesor',
      estado: v.estado,
    };
  });

  const payload = {
    periodo: {
      desde: fechaDesde,
      hasta: fechaHasta,
      periodKey,
    },
    kpis: {
      totalRecaudadoMes,
      totalCuotasMes,
      countCuotasMes,
      totalInicialesMes,
      countInicialesMes,
      totalTransacciones,
      ticketPromedio,
    },
    todosIngresos,
    cuotasMes,
    inicialesMes,
    rankingAsesores,
    desgloseMedios,
    recaudoPorDia,
    lotesCompletamentePagados,
  };

  cierreCache[periodKey] = payload;
  cierreCacheTime[periodKey] = now;

  return payload;
};