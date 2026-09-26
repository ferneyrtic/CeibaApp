import { supabase } from '../supabase';
import { clearCarteraCache } from './cartera';
import { clearCierreCache } from './cierreApi';
import { registrarAccion } from './auditApi';

export const getVentas = async ({ search, estado } = {}) => {
  let query = supabase
    .from('ventas')
    .select(`
      *,
      lotes (id_lote, manzana, lote, area_m2),
      clientes (nombre, celular, ciudad, doc_cliente)
    `)
    .order('created_at', { ascending: false });

  if (estado && estado !== 'Todos') query = query.eq('estado', estado);

  const { data, error } = await query;
  if (error) throw error;

  // Filtro de búsqueda en cliente o lote
  if (search) {
    const s = search.toLowerCase();
    return data.filter(v =>
      v.lotes?.id_lote?.toLowerCase().includes(s) ||
      v.clientes?.nombre?.toLowerCase().includes(s) ||
      v.vendedor_nombre?.toLowerCase().includes(s)
    );
  }
  return data;
};

export const getVentaById = async (id) => {
  const { data, error } = await supabase
    .from('ventas')
    .select('*, lotes(*), clientes(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const createVenta = async (venta) => {
  const { data, error } = await supabase
    .from('ventas').insert(venta).select().single();
  if (error) throw error;

  // Auto-generar cuotas usando la función SQL
  await supabase.rpc('generar_cuotas', { p_venta_id: data.id });

  // Marcar el lote como VENDIDO
  if (venta.lote_id) {
    await supabase
      .from('lotes')
      .update({ estado: 'VENDIDO', precio_venta: venta.precio_venta })
      .eq('id', venta.lote_id);
  }

  clearCarteraCache();
  clearCierreCache();
  return data;
};

export const updateVenta = async (id, updates) => {
  const { data, error } = await supabase
    .from('ventas').update(updates).eq('id', id).select().single();
  if (error) throw error;
  clearCarteraCache();
  clearCierreCache();
  return data;
};

/**
 * Obtiene lista de vendedores activos para selección en ventas
 */
export const getVendedores = async () => {
  const { data, error } = await supabase
    .from('vendedores')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) throw error;
  return data || [];
};

/**
 * Obtiene lotes que están disponibles para ser vendidos
 */
export const getLotesDisponibles = async () => {
  const { data, error } = await supabase
    .from('lotes')
    .select('id, id_lote, etapa, manzana, lote, area_m2, precio_lote, precio_m2, precio_venta, estado, observacion')
    .in('estado', ['DISPONIBLE', 'EN NEGOCIACIÓN', 'APARTADO'])
    .order('manzana', { ascending: true })
    .order('lote', { ascending: true });
  if (error) throw error;
  return data || [];
};

/**
 * Calcula y genera el cronograma proyectado de cuotas
 */
export const generarPlanPagos = ({
  saldoFinanciado,
  plazoCuotas,
  valorCuota,
  diasPago = 15,
  fechaPrimeraCuota,
}) => {
  const cuotas = [];
  const plazo = Number(plazoCuotas) || 0;
  const saldo = Number(saldoFinanciado) || 0;
  if (plazo <= 0 || saldo <= 0) return cuotas;

  const targetDay = Number(diasPago) || 15;

  let baseYear, baseMonth;
  if (fechaPrimeraCuota) {
    const parts = fechaPrimeraCuota.split('-').map(Number);
    baseYear = parts[0];
    baseMonth = parts[1] - 1; // 0-indexed
  } else {
    const now = new Date();
    baseYear = now.getFullYear();
    baseMonth = now.getMonth() + 1; // Próximo mes
  }

  const vCuotaCalc = Number(valorCuota) > 0 ? Number(valorCuota) : Math.round(saldo / plazo);
  let saldoRestante = saldo;
  const hoyStr = new Date().toISOString().slice(0, 10);

  for (let i = 1; i <= plazo; i++) {
    const curMonthIdx = baseMonth + (i - 1);
    const cYear = baseYear + Math.floor(curMonthIdx / 12);
    const cMonth = curMonthIdx % 12;

    const daysInMonth = new Date(cYear, cMonth + 1, 0).getDate();
    const actualDay = Math.min(targetDay, daysInMonth);

    const fVenc = `${cYear}-${String(cMonth + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
    const esUltima = (i === plazo);
    const valor = esUltima ? saldoRestante : Math.min(vCuotaCalc, saldoRestante);
    saldoRestante = Math.max(0, saldoRestante - valor);

    cuotas.push({
      numero_cuota: i,
      fecha_vencimiento: fVenc,
      valor_cuota: valor,
      valor_pagado: 0,
      estado_cuota: fVenc < hoyStr ? 'VENCIDA' : 'AL DÍA',
    });
  }

  return cuotas;
};

/**
 * Registra una venta completa con su cliente, lote, cuotas proyectadas y auditoría
 */
export const registrarVentaCompleta = async ({
  lote,
  cliente,
  vendedor_nombre,
  comision_vendedor = 0,
  precio_venta,
  valor_cuota_inicial = 0,
  fecha_pago_cuota_inicial,
  medio_pago = 'TRANSFERENCIA',
  fecha_venta,
  plazo_cuotas = 0,
  dias_pago = '15',
  valor_cuota = 0,
  cuotas = [],
  observacion = '',
}) => {
  if (!lote?.id) throw new Error('Debe seleccionar un lote válido.');

  // 1. Resolver o Crear Cliente
  let clienteId = cliente?.id;
  let clienteNombre = cliente?.nombre || '';

  if (!clienteId) {
    if (!cliente?.nombre?.trim()) throw new Error('El nombre del cliente es obligatorio.');
    if (!cliente?.doc_cliente?.trim()) throw new Error('El documento del cliente es obligatorio.');

    const { data: newCli, error: cliErr } = await supabase
      .from('clientes')
      .insert({
        nombre: cliente.nombre.trim(),
        doc_cliente: cliente.doc_cliente.trim(),
        celular: cliente.celular ? cliente.celular.trim() : null,
        ciudad: cliente.ciudad ? cliente.ciudad.trim() : 'Acacías',
        direccion: cliente.direccion ? cliente.direccion.trim() : null,
      })
      .select()
      .single();

    if (cliErr) throw new Error(`Error al crear cliente: ${cliErr.message}`);
    clienteId = newCli.id;
    clienteNombre = newCli.nombre;
  }

  const pVenta = Number(precio_venta) || 0;
  const cInicial = Number(valor_cuota_inicial) || 0;
  const sFinanciado = Math.max(0, pVenta - cInicial);
  const fVenta = fecha_venta || new Date().toISOString().slice(0, 10);
  const estadoVenta = sFinanciado === 0 ? 'PAGADO EN SU TOTALIDAD' : 'VENDIDO';

  // 2. Insertar Venta
  const { data: ventaData, error: ventaErr } = await supabase
    .from('ventas')
    .insert({
      lote_id: lote.id,
      cliente_id: clienteId,
      vendedor_nombre: vendedor_nombre || 'DIRECTO',
      estado: estadoVenta,
      precio_venta: pVenta,
      apartados: 0,
      fecha_venta: fVenta,
      valor_cuota_inicial: cInicial,
      fecha_pago_cuota_inicial: cInicial > 0 ? (fecha_pago_cuota_inicial || fVenta) : null,
      medio_pago: medio_pago || 'TRANSFERENCIA',
      saldo_financiado: sFinanciado,
      plazo_cuotas: Number(plazo_cuotas) || 0,
      valor_cuota: Number(valor_cuota) || 0,
      dias_pago: String(dias_pago || '-'),
      comision_vendedor: Number(comision_vendedor) || 0,
      abonos: 0,
      descuentos: 0,
      saldo: sFinanciado,
    })
    .select()
    .single();

  if (ventaErr) throw new Error(`Error al registrar la venta: ${ventaErr.message}`);

  // 3. Insertar Cuotas proyectadas (si aplica financiación)
  if (sFinanciado > 0 && cuotas.length > 0) {
    const hoyStr = new Date().toISOString().slice(0, 10);
    const cuotasRows = cuotas.map(c => ({
      venta_id: ventaData.id,
      numero_cuota: c.numero_cuota,
      fecha_vencimiento: c.fecha_vencimiento,
      valor_cuota: Number(c.valor_cuota),
      valor_pagado: 0,
      estado_cuota: c.fecha_vencimiento < hoyStr ? 'VENCIDA' : 'AL DÍA',
      medio_pago: null,
      comprobante_url: null,
      observacion: null,
    }));

    const { error: cuotasErr } = await supabase
      .from('cuotas')
      .insert(cuotasRows);

    if (cuotasErr) {
      console.error('Error insertando cuotas directas:', cuotasErr);
      // Fallback a RPC generar_cuotas si existiera algún detalle
      try {
        await supabase.rpc('generar_cuotas', { p_venta_id: ventaData.id });
      } catch (rpcErr) {
        console.warn('Fallback RPC generar_cuotas error:', rpcErr);
      }
    }
  }

  // 4. Actualizar Estado y Propietario del Lote
  const estadoLote = sFinanciado === 0 ? 'VENDIDO' : 'VENDIDO';
  const { error: loteErr } = await supabase
    .from('lotes')
    .update({
      estado: estadoLote,
      precio_venta: pVenta,
      propietario: clienteNombre,
      observacion: observacion ? observacion : lote.observacion || null,
    })
    .eq('id', lote.id);

  if (loteErr) {
    console.warn('Aviso actualizando lote:', loteErr);
  }

  // 5. Registrar Acción en Auditoría
  try {
    await registrarAccion({
      modulo: 'VENTAS',
      accion: 'VENTA_REGISTRADA',
      lote_id: lote.id,
      lote_id_str: lote.id_lote || `Lote ${lote.id}`,
      cliente_nombre: clienteNombre,
      descripcion: `Venta registrada para lote ${lote.id_lote || lote.id}: Cliente ${clienteNombre}, Precio $${pVenta.toLocaleString('es-CO')}, Inicial $${cInicial.toLocaleString('es-CO')}, Financiado $${sFinanciado.toLocaleString('es-CO')} (${plazo_cuotas} cuotas)`,
      detalles: {
        venta_id: ventaData.id,
        lote_id: lote.id,
        id_lote: lote.id_lote,
        cliente: clienteNombre,
        vendedor: vendedor_nombre,
        precio_venta: pVenta,
        cuota_inicial: cInicial,
        saldo_financiado: sFinanciado,
        plazo_cuotas,
        valor_cuota,
        cuotas_generadas: cuotas.length,
      }
    });
  } catch (logErr) {
    console.warn('Aviso guardando log de auditoría:', logErr);
  }

  // 6. Limpiar cachés para reflejar la cuenta por cobrar en tiempo real
  clearCarteraCache();
  clearCierreCache();

  return ventaData;
};
