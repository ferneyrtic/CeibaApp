import { supabase } from '../supabase';

// Cache en memoria por periodo (e.g. '2026-08') para navegación instantánea
let cierreCache = {};
let cierreCacheTime = {};

export const clearCierreCache = () => {
  cierreCache = {};
  cierreCacheTime = {};
};

/**
 * Consulta y consolida todos los recaudos reales del mes por Fecha de Pago (Flujo de Caja)
 * @param {number|string} year - Año (e.g. 2026)
 * @param {number|string} month - Mes (1-12 o '01'-'12')
 * @param {boolean} forceRefresh - Forzar recarga sin usar caché
 */
export const getCierreMensualData = async (year, month, forceRefresh = false) => {
  const yNum = Number(year);
  const mNum = Number(month);
  const mStr = String(mNum).padStart(2, '0');
  const periodKey = `${yNum}-${mStr}`;
  const now = Date.now();

  // Cache de 45 segundos si no se solicita refresco forzado
  if (!forceRefresh && cierreCache[periodKey] && (now - (cierreCacheTime[periodKey] || 0) < 45000)) {
    return cierreCache[periodKey];
  }

  // Rango de fechas exacto del mes seleccionado
  const lastDay = new Date(yNum, mNum, 0).getDate();
  const desde = `${yNum}-${mStr}-01`;
  const hasta = `${yNum}-${mStr}-${String(lastDay).padStart(2, '0')}`;

  // 1. Consultar en paralelo Cuotas y Cuotas Iniciales con fecha de pago en el mes
  const [cuotasRes, inicialesRes] = await Promise.all([
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
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta)
      .order('fecha_pago', { ascending: true }),

    supabase
      .from('ventas')
      .select(`
        id, fecha_venta, precio_venta, valor_cuota_inicial, fecha_pago_cuota_inicial,
        medio_pago, vendedor_nombre, saldo_financiado, plazo_cuotas, valor_cuota,
        lotes (id_lote, manzana, lote, etapa),
        clientes (id, nombre, celular, doc_cliente, ciudad)
      `)
      .gte('fecha_pago_cuota_inicial', desde)
      .lte('fecha_pago_cuota_inicial', hasta)
      .order('fecha_pago_cuota_inicial', { ascending: true })
  ]);

  if (cuotasRes.error) throw cuotasRes.error;
  if (inicialesRes.error) throw inicialesRes.error;

  const rawCuotas = cuotasRes.data || [];
  const rawIniciales = inicialesRes.data || [];

  // 2. Normalizar y Unificar en Lista de Ingresos Efectivos
  const cuotasMes = rawCuotas
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

  // 6. Recaudo por Día del Mes
  const diaMap = {};
  for (let d = 1; d <= lastDay; d++) {
    const dStr = String(d).padStart(2, '0');
    const fStr = `${yNum}-${mStr}-${dStr}`;
    diaMap[fStr] = { dia: d, fecha: fStr, cuotasMonto: 0, inicialesMonto: 0, totalDia: 0, count: 0 };
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

  const payload = {
    periodo: {
      year: yNum,
      month: mNum,
      periodKey,
      desde,
      hasta,
      lastDay,
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
  };

  cierreCache[periodKey] = payload;
  cierreCacheTime[periodKey] = now;

  return payload;
};