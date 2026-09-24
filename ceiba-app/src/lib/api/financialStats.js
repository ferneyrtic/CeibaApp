import { supabase } from '../supabase';
import { getCartera, clearCarteraCache } from './cartera';

// Cache unificado en memoria con TTL de 45 segundos
let sharedStatsCache = null;
let sharedStatsCacheTime = 0;

export const clearFinancialStatsCache = () => {
  sharedStatsCache = null;
  sharedStatsCacheTime = 0;
  clearCarteraCache();
};

/**
 * Fuente única de verdad matemática para métricas financieras y de cartera.
 * Usada idénticamente por Dashboard y Cartera para garantizar 0 discrepancias.
 */
export const getSharedFinancialStats = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && sharedStatsCache && (now - sharedStatsCacheTime < 45000)) {
    return sharedStatsCache;
  }

  const today = new Date().toISOString().slice(0, 10);
  const in7DaysDate = new Date();
  in7DaysDate.setDate(in7DaysDate.getDate() + 7);
  const in7Days = in7DaysDate.toISOString().slice(0, 10);

  const in30DaysDate = new Date();
  in30DaysDate.setDate(in30DaysDate.getDate() + 30);
  const in30Days = in30DaysDate.toISOString().slice(0, 10);

  // 1. Consultas en paralelo para máxima velocidad
  const [
    carteraData,
    lotesRes,
    vencidasCuotasRes,
    alDiaCuotasRes,
    pagasCuotasRes,
    totalCuotasRes,
    vencen7DRes,
    vencen30DRes,
    cuotasMoraVentaIdsRes
  ] = await Promise.all([
    getCartera({ forceRefresh }),
    supabase.from('lotes').select('estado'),
    supabase.from('cuotas').select('id', { count: 'exact', head: true }).eq('estado_cuota', 'VENCIDA'),
    supabase.from('cuotas').select('id', { count: 'exact', head: true }).eq('estado_cuota', 'AL DÍA'),
    supabase.from('cuotas').select('id', { count: 'exact', head: true }).eq('estado_cuota', 'PAGA'),
    supabase.from('cuotas').select('id', { count: 'exact', head: true }),
    supabase.from('cuotas').select('id', { count: 'exact', head: true }).gte('fecha_vencimiento', today).lte('fecha_vencimiento', in7Days).neq('estado_cuota', 'PAGA'),
    supabase.from('cuotas').select('id', { count: 'exact', head: true }).gte('fecha_vencimiento', today).lte('fecha_vencimiento', in30Days).neq('estado_cuota', 'PAGA'),
    supabase.from('cuotas').select('venta_id').eq('estado_cuota', 'VENCIDA').limit(5000),
  ]);

  // 2. Conteo de lotes por estado
  const estadosLotes = {};
  (lotesRes.data || []).forEach(l => {
    estadosLotes[l.estado] = (estadosLotes[l.estado] || 0) + 1;
  });

  const rows = carteraData || [];
  const vendidos = rows.filter(r => ['VENDIDO', 'PAGADO EN SU TOTALIDAD', 'PAGADO', 'SALDADO'].includes(r.estado));

  // 3. Totales financieros consolidados
  const totalValorVentas     = vendidos.reduce((a, v) => a + (Number(v.precio_venta) || 0), 0);
  const totalCuotaInicial    = vendidos.reduce((a, v) => a + (Number(v.valor_cuota_inicial) || 0), 0);
  const totalSaldoFinanciado = vendidos.reduce((a, v) => a + (Number(v.saldo_financiado) || 0), 0);
  const totalCuotasPagadas   = rows.reduce((a, v) => a + (Number(v.cuotas_pagadas_monto) || 0), 0);
  const totalRecaudado       = totalCuotaInicial + totalCuotasPagadas;
  const totalSaldo           = Math.max(0, totalSaldoFinanciado - totalCuotasPagadas);

  const conSaldo             = vendidos.filter(v => (v.saldo || 0) > 0).length;
  const sinGestion           = vendidos.filter(v => !v.fecha_venta && (v.saldo || 0) > 0).length;

  // 4. Clientes en mora únicos (con al menos 1 cuota vencida)
  const uniqueMoraVentas = new Set((cuotasMoraVentaIdsRes.data || []).map(c => c.venta_id).filter(Boolean));
  // Cruzar con contratos que tienen cuotas_vencidas > 0 en carteraData
  const clientesEnMora = rows.filter(r => (Number(r.cuotas_vencidas) || 0) > 0).length || uniqueMoraVentas.size;
  const clientesAlDia  = Math.max(0, vendidos.length - clientesEnMora);

  const cuotasVencidas   = vencidasCuotasRes.count || 0;
  const cuotasAlDia      = alDiaCuotasRes.count || 0;
  const cuotasPagadas    = pagasCuotasRes.count || 0;
  const totalCuotas      = totalCuotasRes.count || 0;
  const cuotasVencen7D   = vencen7DRes.count || 0;
  const cuotasVencen30D  = vencen30DRes.count || 0;

  const estadoCartera = [
    { name: 'Pagadas',           value: cuotasPagadas,   color: '#16a34a' },
    { name: 'Vencen en 30 días', value: cuotasVencen30D, color: '#d97706' },
    { name: 'En Mora',           value: cuotasVencidas,  color: '#dc2626' },
  ].filter(e => e.value > 0);

  sharedStatsCache = {
    // Lotes
    totalLotes:          lotesRes.data?.length || 0,
    lotesVendidos:       estadosLotes['VENDIDO'] || 0,
    lotesDisponibles:    estadosLotes['DISPONIBLE'] || 0,
    lotesNegociacion:    (estadosLotes['EN NEGOCIACIÓN'] || 0) + (estadosLotes['EN NEGOCIACI\uFFFDN'] || 0),
    lotesApartados:      estadosLotes['APARTADO'] || 0,
    lotesNoAptos:        estadosLotes['NO APTO PARA VENTA'] || 0,

    // Financiero
    totalValorVentas,
    totalProyectado:     totalValorVentas,
    totalCuotaInicial,
    totalSaldoFinanciado,
    totalCuotasPagadas,
    totalRecaudado,
    totalSaldo,
    totalSaldoPendiente: totalSaldo,
    conSaldo,
    sinGestion,
    totalVentas:         vendidos.length,

    // Cartera / Mora
    clientesEnMora,
    carteraMora:         clientesEnMora,
    clientesAlDia,
    cuotasVencidas,
    cuotasAlDia,
    cuotasPagadas,
    totalCuotas,
    cuotasPorVencer:     cuotasVencen7D,
    cuotasMesActual:     cuotasVencen30D,
    estadoCartera,
  };

  sharedStatsCacheTime = now;
  return sharedStatsCache;
};
