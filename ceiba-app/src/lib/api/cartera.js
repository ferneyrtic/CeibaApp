import { supabase } from '../supabase';

// Cache ligero en memoria para respuesta instantánea (TTL: 45s)
let carteraCache = null;
let carteraCacheTime = 0;
let statsCache = null;
let statsCacheTime = 0;

export const clearCarteraCache = () => {
  carteraCache = null;
  carteraCacheTime = 0;
  statsCache = null;
  statsCacheTime = 0;
};

export const getCartera = async ({ search, filtroEstado, forceRefresh = false, retries = 1 } = {}) => {
  const now = Date.now();
  if (!forceRefresh && carteraCache && (now - carteraCacheTime < 45000)) {
    return applyCarteraFilters(carteraCache, { search, filtroEstado });
  }

  // 1. Obtener consolidado, ventas y cuotas críticas en paralelo
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 180);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  try {
    const [carteraRes, ventasDetalleRes, vCriticasRes] = await Promise.all([
      supabase
        .from('v_cartera_total')
        .select('*')
        .order('saldo', { ascending: false }),
      supabase
        .from('ventas')
        .select(`
          id, dias_pago, medio_pago, fecha_pago_cuota_inicial,
          abonos, descuentos, comision_vendedor,
          lotes (id_lote, manzana, lote, etapa, area_m2),
          clientes (id, nombre, doc_cliente, celular, ciudad, direccion)
        `),
      supabase
        .from('cuotas')
        .select('venta_id')
        .eq('estado_cuota', 'VENCIDA')
        .lte('fecha_vencimiento', cutoffStr)
    ]);

    if (carteraRes.error) throw carteraRes.error;
    if (ventasDetalleRes.error) throw ventasDetalleRes.error;

    const ventasMap = new Map((ventasDetalleRes.data || []).map(v => [v.id, v]));
    const critIds = new Set((vCriticasRes.data || []).map(c => c.venta_id));

    const consolidated = (carteraRes.data || []).map(item => {
      const detalle = ventasMap.get(item.venta_id) || {};
      const cuotasPagadas = Number(item.cuotas_pagadas) || 0;
      const cuotaInicial  = Number(item.cuota_inicial) || 0;
      const saldoFin      = Number(item.saldo_financiado) || 0;
      const precioVenta   = Number(item.valor_venta) || 0;

      // Saldo y pagos limpios sin mezclar comisiones de asesores
      const saldoReal = saldoFin > 0
        ? Math.max(0, saldoFin - cuotasPagadas)
        : Math.max(0, precioVenta - cuotaInicial - cuotasPagadas);
      const totalPagadoReal = cuotaInicial + cuotasPagadas;

      return {
        id: item.venta_id,
        venta_id: item.venta_id,
        id_lote: item.id_lote,
        estado: item.estado,
        precio_venta: precioVenta,
        valor_cuota_inicial: cuotaInicial,
        saldo_financiado: saldoFin,
        cuotas_pagadas_monto: cuotasPagadas,
        total_pagado: totalPagadoReal,
        saldo: saldoReal,
        cliente_nombre: item.cliente_nombre,
        vendedor_nombre: item.vendedor_nombre,
        plazo_cuotas: item.plazo_cuotas,
        valor_cuota: Number(item.valor_cuota) || 0,
        fecha_venta: item.fecha_venta,
        cuotas_vencidas: Number(item.cuotas_vencidas) || 0,
        cuotas_por_vencer: Number(item.cuotas_por_vencer) || 0,
        cuotas_pagadas_count: Number(item.cuotas_pagadas_count) || 0,
        total_cuotas: Number(item.total_cuotas) || 0,
        es_critico: critIds.has(item.venta_id),
        dias_pago: detalle.dias_pago,
        medio_pago: detalle.medio_pago,
        fecha_pago_cuota_inicial: detalle.fecha_pago_cuota_inicial,
        comision_vendedor: detalle.comision_vendedor,
        abonos: detalle.abonos,
        descuentos: detalle.descuentos,
        lotes: detalle.lotes || { id_lote: item.id_lote },
        clientes: detalle.clientes || { nombre: item.cliente_nombre },
      };
    });

    carteraCache = consolidated;
    carteraCacheTime = now;

    return applyCarteraFilters(consolidated, { search, filtroEstado });
  } catch (err) {
    if (retries > 0) {
      console.warn('Timeout o error transitorio en Supabase al cargar cartera. Reintentando...', err);
      await new Promise(r => setTimeout(r, 1200));
      return getCartera({ search, filtroEstado, forceRefresh: true, retries: retries - 1 });
    }
    if (carteraCache) {
      console.warn('Usando caché de cartera existente tras error de red o timeout:', err);
      return applyCarteraFilters(carteraCache, { search, filtroEstado });
    }
    throw err;
  }
};

function applyCarteraFilters(data, { search, filtroEstado }) {
  let result = data;

  if (filtroEstado && filtroEstado !== 'Todos') {
    if (filtroEstado === 'Con Saldo') {
      result = result.filter(v => v.saldo > 0 && v.estado !== 'PAGADO EN SU TOTALIDAD' && v.estado !== 'PAGADO');
    } else if (filtroEstado === 'Pagado') {
      result = result.filter(v => v.saldo <= 0 || v.estado === 'PAGADO EN SU TOTALIDAD' || v.estado === 'PAGADO' || v.estado === 'SALDADO');
    } else if (filtroEstado === 'En Mora') {
      result = result.filter(v => v.cuotas_vencidas > 0);
    } else if (filtroEstado === 'Sin Gestión') {
      result = result.filter(v => !v.fecha_venta && v.saldo > 0);
    } else if (filtroEstado === '🚨 Casos Críticos (>180 días)' || filtroEstado === 'Casos Críticos') {
      result = result.filter(v => v.es_critico && v.saldo > 0);
    }
  }

  if (search) {
    const s = search.toLowerCase().trim();
    result = result.filter(v =>
      (v.id_lote && v.id_lote.toLowerCase().includes(s)) ||
      (v.lotes?.id_lote && v.lotes.id_lote.toLowerCase().includes(s)) ||
      (v.cliente_nombre && v.cliente_nombre.toLowerCase().includes(s)) ||
      (v.clientes?.nombre && v.clientes.nombre.toLowerCase().includes(s)) ||
      (v.vendedor_nombre && v.vendedor_nombre.toLowerCase().includes(s)) ||
      (v.clientes?.doc_cliente && String(v.clientes.doc_cliente).toLowerCase().includes(s)) ||
      (v.clientes?.celular && String(v.clientes.celular).includes(s))
    );
  }

  return result;
}

export const getCarteraStats = async (forceRefresh = false) => {
  const { getSharedFinancialStats } = await import('./financialStats');
  return getSharedFinancialStats(forceRefresh);
};


export const getCuotasByVenta = async (ventaId) => {
  const { data, error } = await supabase
    .from('cuotas')
    .select('*')
    .eq('venta_id', ventaId)
    .order('numero_cuota', { ascending: true });
  if (error) throw error;
  return data || [];
};
