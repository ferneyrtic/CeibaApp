import { supabase } from '../supabase';

// Cache en memoria para comisiones
let comisionesCache = null;
let comisionesCacheTime = 0;

export const getComisionesData = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && comisionesCache && (now - comisionesCacheTime < 30000)) {
    return comisionesCache;
  }

  // 1. Obtener ventas con vendedores y comisiones
  const [ventasRes, vendedoresRes, pagosRes] = await Promise.all([
    supabase
      .from('ventas')
      .select('id, precio_venta, valor_cuota_inicial, comision_vendedor, vendedor_nombre, fecha_venta, saldo, lotes(id_lote), clientes(nombre, celular)')
      .order('fecha_venta', { ascending: false }),

    supabase
      .from('vendedores')
      .select('*')
      .order('nombre', { ascending: true }),

    supabase
      .from('datos_maestros')
      .select('*')
      .eq('tipo', 'PAGO_COMISION')
      .order('orden', { ascending: false }),
  ]);

  if (ventasRes.error) throw ventasRes.error;

  const ventas = ventasRes.data || [];
  const vendedoresList = vendedoresRes.data || [];
  const rawPagos = pagosRes.data || [];

  // Parsear pagos almacenados
  const pagos = rawPagos.map(item => {
    try {
      const parsed = typeof item.valor === 'string' ? JSON.parse(item.valor) : item.valor;
      return {
        id: item.id,
        ...parsed,
        created_at: parsed.created_at || new Date(item.orden || Date.now()).toISOString(),
      };
    } catch {
      return {
        id: item.id,
        vendedor_nombre: 'DESCONOCIDO',
        valor: 0,
        fecha_pago: new Date().toISOString().slice(0, 10),
        medio_pago: 'EFECTIVO',
        observacion: item.valor,
      };
    }
  }).sort((a, b) => new Date(b.fecha_pago || b.created_at) - new Date(a.fecha_pago || a.created_at));

  // Consolidar comisiones por Asesor / Vendedor
  const asesorMap = {};

  // Inicializar con todos los vendedores registrados
  vendedoresList.forEach(v => {
    if (!v.nombre) return;
    const key = v.nombre.trim().toUpperCase();
    asesorMap[key] = {
      nombre: key,
      porcentaje: v.porcentaje_comision || 5,
      totalVentas: 0,
      valorTotalVendido: 0,
      totalComisiones: 0,
      totalPagado: 0,
      saldoPendiente: 0,
      ventas: [],
      pagos: [],
    };
  });

  // Sumar ventas y comisiones
  ventas.forEach(v => {
    const rawNom = v.vendedor_nombre || 'SIN ASIGNAR';
    const key = rawNom.trim().toUpperCase();
    if (!asesorMap[key]) {
      asesorMap[key] = {
        nombre: key,
        porcentaje: 5,
        totalVentas: 0,
        valorTotalVendido: 0,
        totalComisiones: 0,
        totalPagado: 0,
        saldoPendiente: 0,
        ventas: [],
        pagos: [],
      };
    }
    asesorMap[key].totalVentas += 1;
    asesorMap[key].valorTotalVendido += (v.precio_venta || 0);
    asesorMap[key].totalComisiones += (v.comision_vendedor || 0);
    asesorMap[key].ventas.push(v);
  });

  // Sumar pagos realizados por asesor
  pagos.forEach(p => {
    const rawNom = p.vendedor_nombre || 'SIN ASIGNAR';
    const key = rawNom.trim().toUpperCase();
    if (!asesorMap[key]) {
      asesorMap[key] = {
        nombre: key,
        porcentaje: 5,
        totalVentas: 0,
        valorTotalVendido: 0,
        totalComisiones: 0,
        totalPagado: 0,
        saldoPendiente: 0,
        ventas: [],
        pagos: [],
      };
    }
    asesorMap[key].totalPagado += (parseFloat(p.valor) || 0);
    asesorMap[key].pagos.push(p);
  });

  // Calcular saldos pendientes por asesor
  Object.values(asesorMap).forEach(a => {
    a.saldoPendiente = a.totalComisiones - a.totalPagado;
    a.porcentajeLiquidado = a.totalComisiones > 0
      ? Math.min(100, Math.round((a.totalPagado / a.totalComisiones) * 100))
      : (a.totalPagado > 0 ? 100 : 0);
  });

  const asesoresArray = Object.values(asesorMap)
    .filter(a => a.totalVentas > 0 || a.totalPagado > 0)
    .sort((a, b) => b.totalComisiones - a.totalComisiones);

  // Totales Generales del Proyecto
  const totalComisionesProyecto = asesoresArray.reduce((acc, a) => acc + a.totalComisiones, 0);
  const totalLiquidadoPagado = pagos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
  const saldoTotalPendiente = totalComisionesProyecto - totalLiquidadoPagado;

  // Pagos del mes actual
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const pagosMesActual = pagos.filter(p => (p.fecha_pago || '').startsWith(currentMonthStr));
  const totalPagadoMesActual = pagosMesActual.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);

  comisionesCache = {
    asesores: asesoresArray,
    pagos,
    ventas,
    kpis: {
      totalComisionesProyecto,
      totalLiquidadoPagado,
      saldoTotalPendiente,
      totalAsesoresActivos: asesoresArray.length,
      totalPagosRegistrados: pagos.length,
      totalPagadoMesActual,
      pagosMesActualCount: pagosMesActual.length,
    },
    loadedAt: new Date(),
  };
  comisionesCacheTime = now;

  return comisionesCache;
};

export const registrarPagoComision = async (pagoData) => {
  const payload = {
    vendedor_nombre: pagoData.vendedor_nombre?.trim().toUpperCase(),
    valor: parseFloat(pagoData.valor) || 0,
    fecha_pago: pagoData.fecha_pago || new Date().toISOString().slice(0, 10),
    medio_pago: pagoData.medio_pago || 'TRANSFERENCIA BANCARIA',
    lote: pagoData.lote ? pagoData.lote.trim().toUpperCase() : null,
    comprobante: pagoData.comprobante ? pagoData.comprobante.trim() : null,
    observacion: pagoData.observacion ? pagoData.observacion.trim() : '',
    registrado_por: pagoData.registrado_por || 'ADMIN',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('datos_maestros')
    .insert([{
      tipo: 'PAGO_COMISION',
      valor: JSON.stringify(payload),
      orden: Date.now(),
    }])
    .select();

  if (error) throw error;

  // Invalidar caché
  comisionesCache = null;
  comisionesCacheTime = 0;

  return {
    id: data?.[0]?.id,
    ...payload,
  };
};
