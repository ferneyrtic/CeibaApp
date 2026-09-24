import { supabase } from '../supabase';

// Cache en memoria con TTL de 30 segundos
let reportesCache = null;
let reportesCacheTime = 0;

export const getReportesData = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && reportesCache && (now - reportesCacheTime < 30000)) {
    return reportesCache;
  }

  // Ejecutar queries en paralelo
  const [carteraTotalRes, ventasRes, lotesRes, cuotasMoraRes] = await Promise.all([
    supabase
      .from('v_cartera_total')
      .select('*')
      .order('saldo', { ascending: false }),

    supabase
      .from('ventas')
      .select(`
        id, precio_venta, valor_cuota_inicial, fecha_venta,
        fecha_pago_cuota_inicial, medio_pago, saldo_financiado,
        plazo_cuotas, valor_cuota, dias_pago, abonos, descuentos,
        saldo, vendedor_nombre, comision_vendedor,
        lotes (id, id_lote, area_m2, manzana, lote, etapa),
        clientes (id, nombre, celular, ciudad, doc_cliente, direccion)
      `),

    supabase
      .from('lotes')
      .select('id, id_lote, etapa, manzana, lote, area_m2, precio_lote, estado, precio_venta, contrato, escritura, fecha_escritura, porcentaje_escriturado, propietario, observacion')
      .order('manzana', { ascending: true })
      .order('lote', { ascending: true }),

    supabase
      .from('cuotas')
      .select('id, venta_id, numero_cuota, fecha_vencimiento, valor_cuota, estado_cuota, fecha_pago, valor_pagado')
      .in('estado_cuota', ['VENCIDA', 'POR VENCER'])
      .order('fecha_vencimiento', { ascending: true }),
  ]);

  if (carteraTotalRes.error) throw carteraTotalRes.error;
  if (ventasRes.error) throw ventasRes.error;
  if (lotesRes.error) throw lotesRes.error;
  if (cuotasMoraRes.error) throw cuotasMoraRes.error;

  const carteraRows = carteraTotalRes.data || [];
  const ventasRaw = ventasRes.data || [];
  const lotes = lotesRes.data || [];
  const cuotasMoraRaw = cuotasMoraRes.data || [];

  // Mapear cartera consolidada por venta_id
  const carteraMap = new Map(carteraRows.map(c => [c.venta_id, c]));

  // Enriquecer ventas con datos de cartera real
  const ventas = ventasRaw.map(v => {
    const cart = carteraMap.get(v.id) || {};
    return {
      ...v,
      // Métricas de cliente reales
      saldo_cliente: Number(cart.saldo) || 0,
      cuotas_pagadas_monto: Number(cart.cuotas_pagadas) || 0,
      cuotas_pagadas_count: Number(cart.cuotas_pagadas_count) || 0,
      total_pagado_cliente: Number(cart.total_pagado) || 0,
      cuotas_vencidas_count: Number(cart.cuotas_vencidas) || 0,
      total_cuotas_plan: Number(cart.total_cuotas) || v.plazo_cuotas || 0,
      // Saldo deudor prioritario para reportes
      saldo: Number(cart.saldo) || 0,
      // Comisión del asesor
      comision_saldo: Number(v.saldo) || 0,
    };
  });

  const ventasMap = new Map(ventas.map(v => [v.id, v]));

  // Enriquecer cuotas de mora
  const cuotasMora = cuotasMoraRaw.map(c => {
    const v = ventasMap.get(c.venta_id);
    return {
      ...c,
      ventas: v ? {
        vendedor_nombre: v.vendedor_nombre,
        saldo: v.saldo,
        lotes: v.lotes ? { id_lote: v.lotes.id_lote } : null,
        clientes: v.clientes ? { nombre: v.clientes.nombre, celular: v.clientes.celular, doc_cliente: v.clientes.doc_cliente } : null,
      } : null,
    };
  });

  reportesCache = {
    ventas,
    lotes,
    cuotasMora,
    carteraRows,
    clientes: [],
    loadedAt: new Date(),
  };
  reportesCacheTime = now;

  return reportesCache;
};

export const clearReportesCache = () => {
  reportesCache = null;
  reportesCacheTime = 0;
};
