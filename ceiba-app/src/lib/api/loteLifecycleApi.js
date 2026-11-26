import * as sbModule from '../supabase.js';
const supabase = sbModule.supabase;
const supabaseAdmin = sbModule.supabaseAdmin || sbModule.supabase;

import { registrarAccion } from './auditApi';
import { registrarVentaCompleta } from './ventas';
import { clearCarteraCache } from './cartera';
import { obtenerSiguienteNumeroRecibo, clearRecibosCache } from './recibosApi';
import { numeroALetrasCOP } from '../../utils/numeroALetras';

/**
 * Calcula cuántos lotes físicos representa un registro (ej: "LC1 - 12 - 8 y 9" -> 2 lotes físicos)
 */
export function countPhysicalLots(lote) {
  if (!lote) return 0;
  const raw = String(lote.lote || lote.id_lote || '').trim();
  if (!raw) return 1;
  // Si el campo lote o id_lote contiene " Y " o " y " o "&" o " - " múltiple al final
  const idStr = String(lote.id_lote || '').toUpperCase();
  const tail = idStr.split('-').slice(2).join('-').trim() || raw.toUpperCase();
  const parts = tail.split(/\s*(?:Y|&|,)\s*/).filter(p => /\d+/.test(p));
  return parts.length > 1 ? parts.length : 1;
}

/**
 * Resuelve o crea un cliente en Supabase
 */
async function resolveOrCreateCliente(cliente) {
  if (cliente?.id) return cliente;
  if (!cliente?.nombre?.trim()) throw new Error('El nombre del cliente es obligatorio.');
  if (!cliente?.doc_cliente?.trim()) throw new Error('El documento del cliente es obligatorio.');

  const { data: existing } = await supabase
    .from('clientes')
    .select('*')
    .eq('doc_cliente', cliente.doc_cliente.trim())
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('clientes')
    .insert({
      nombre: cliente.nombre.trim().toUpperCase(),
      doc_cliente: cliente.doc_cliente.trim(),
      celular: cliente.celular ? cliente.celular.trim() : null,
      ciudad: cliente.ciudad ? cliente.ciudad.trim() : 'Acacías',
      direccion: cliente.direccion ? cliente.direccion.trim() : null,
    })
    .select()
    .single();
  if (error) throw new Error(`Error creando cliente: ${error.message}`);
  return created;
}

/**
 * Paso 1 del flujo estándar:
 * GENERAR ARRAS sobre un lote DISPONIBLE.
 * - Crea/asocia cliente
 * - Emite Recibo Oficial de Arras (consecutivo automático)
 * - Cambia el lote a APARTADO
 * - Registra la reserva activa en datos_maestros (ARRAS_LOTE) y auditoría
 */
export async function generarArrasLote({
  lote,
  cliente,
  valor_arras,
  fecha_pago,
  fecha_limite,
  medio_pago = 'TRANSFERENCIA',
  banco = '',
  referencia = '',
  vendedor_nombre = '',
  observacion = '',
  usuario = {}
}) {
  if (!lote?.id) throw new Error('Lote inválido.');
  const monto = Number(valor_arras) || 0;
  if (monto <= 0) throw new Error('El valor de las arras debe ser mayor a $0.');

  const cli = await resolveOrCreateCliente(cliente);
  const fPago = fecha_pago || new Date().toISOString().slice(0, 10);
  const fLimite = fecha_limite || (() => {
    const d = new Date(fPago + 'T12:00:00');
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  })();

  const numRecibo = await obtenerSiguienteNumeroRecibo();
  const payloadRecibo = {
    numero_recibo: numRecibo,
    recibo_numero: numRecibo,
    pagado_a: 'PROYECTO CAMPESTRE LA CEIBA',
    ciudad: 'Acacías',
    estado: 'ARRAS',
    estado_recibo: 'ARRAS',
    lote_id: lote.id,
    lote_id_str: lote.id_lote,
    cliente_id: cli.id,
    cliente_nombre: cli.nombre,
    cliente_doc: cli.doc_cliente,
    fecha_pago: fPago,
    valor: monto,
    valor_pagado: monto,
    valor_letras: numeroALetrasCOP(monto),
    concepto: `Arras de separación - ${lote.id_lote}`,
    medio_pago,
    banco,
    referencia_pago: referencia,
    referencia,
    observaciones: `Arras válidas hasta ${fLimite}${observacion ? ' · ' + observacion : ''}`,
    registrado_por: usuario?.nombre || 'Secretaría',
    created_at: new Date().toISOString(),
  };

  const dbClient = supabaseAdmin || supabase;
  const { error: recErr } = await dbClient.from('datos_maestros').insert({
    tipo: 'RECIBO_CAJA',
    orden: numRecibo,
    valor: JSON.stringify(payloadRecibo),
  });
  if (recErr) throw new Error(`Error emitiendo recibo de arras: ${recErr.message}`);

  const arrasRecord = {
    lote_id: lote.id,
    id_lote: lote.id_lote,
    cliente_id: cli.id,
    cliente_nombre: cli.nombre,
    cliente_doc: cli.doc_cliente,
    cliente_celular: cli.celular || '',
    cliente_ciudad: cli.ciudad || '',
    valor_arras: monto,
    fecha_pago: fPago,
    fecha_limite: fLimite,
    medio_pago,
    banco,
    referencia,
    numero_recibo: numRecibo,
    vendedor_nombre: vendedor_nombre || 'DIRECTO',
    estado: 'ACTIVA',
    observacion,
    created_at: new Date().toISOString(),
  };

  await dbClient.from('datos_maestros').insert({
    tipo: 'ARRAS_LOTE',
    orden: Math.floor(Date.now() / 1000),
    valor: JSON.stringify(arrasRecord),
  });

  const obsLote = `Arras de apartado por ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(monto)} con Recibo #${numRecibo} el ${fPago}. Válidas hasta ${fLimite}. Titular: ${cli.nombre}.${observacion ? ' ' + observacion : ''}`;

  const { error: loteErr } = await supabase
    .from('lotes')
    .update({
      estado: 'APARTADO',
      propietario: cli.nombre,
      observacion: obsLote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lote.id);
  if (loteErr) throw new Error(`Error actualizando estado del lote: ${loteErr.message}`);

  await registrarAccion({
    modulo: 'LOTES_ARRAS',
    accion: 'GENERAR_ARRAS',
    lote_id_str: lote.id_lote,
    lote_id: lote.id,
    cliente_nombre: cli.nombre,
    usuario,
    descripcion: `Arras generadas por $${monto.toLocaleString('es-CO')} (Recibo #${numRecibo}) para ${lote.id_lote} a nombre de ${cli.nombre}`,
    detalles: arrasRecord,
  });

  clearRecibosCache();
  clearCarteraCache();

  return { arras: arrasRecord, recibo: payloadRecibo, cliente: cli };
}

/**
 * Obtiene la reserva de arras activa de un lote (desde ARRAS_LOTE o fallback de RECIBO_CAJA)
 */
export async function obtenerArrasActiva(lote) {
  if (!lote?.id) return null;
  try {
    const dbClient = supabaseAdmin || supabase;
    const { data } = await dbClient
      .from('datos_maestros')
      .select('id, valor')
      .eq('tipo', 'ARRAS_LOTE')
      .order('orden', { ascending: false });

    const match = (data || []).find(row => {
      try {
        const v = typeof row.valor === 'string' ? JSON.parse(row.valor) : row.valor;
        return v.lote_id === lote.id && v.estado === 'ACTIVA';
      } catch {
        return false;
      }
    });

    if (match) {
      const parsed = typeof match.valor === 'string' ? JSON.parse(match.valor) : match.valor;
      return { dm_id: match.id, ...parsed };
    }

    // Fallback: buscar último recibo de ARRAS para ese lote
    const { data: recRows } = await dbClient
      .from('datos_maestros')
      .select('orden, valor')
      .eq('tipo', 'RECIBO_CAJA')
      .order('orden', { ascending: false })
      .limit(100);

    const recMatch = (recRows || []).find(r => {
      try {
        const v = typeof r.valor === 'string' ? JSON.parse(r.valor) : r.valor;
        return (v.lote_id === lote.id || v.lote_id_str === lote.id_lote) &&
          (v.estado === 'ARRAS' || String(v.concepto || '').toLowerCase().includes('arras'));
      } catch {
        return false;
      }
    });

    if (recMatch && lote.estado === 'APARTADO') {
      const rv = typeof recMatch.valor === 'string' ? JSON.parse(recMatch.valor) : recMatch.valor;
      return {
        lote_id: lote.id,
        id_lote: lote.id_lote,
        cliente_id: rv.cliente_id || null,
        cliente_nombre: rv.cliente_nombre || lote.propietario || '',
        cliente_doc: rv.cliente_doc || '',
        valor_arras: Number(rv.valor || rv.valor_pagado) || 0,
        fecha_pago: rv.fecha_pago,
        numero_recibo: recMatch.orden,
        estado: 'ACTIVA',
      };
    }
  } catch (e) {
    console.warn('Error consultando arras activa:', e);
  }
  return null;
}

/**
 * Paso 2 del flujo estándar:
 * GENERAR CONTRATO (desde APARTADO con arras previas o desde DISPONIBLE directo).
 * - Suma arras previas + cuota inicial pagada hoy (si aplica)
 * - Emite Recibo Oficial por la Cuota Inicial pagada hoy (si > 0)
 * - Registra Venta + Cuotas + Lote VENDIDO (contrato = SI)
 * - Guarda CONTRATO_VENTA completo en datos_maestros
 */
export async function generarContratoLote({
  lote,
  cliente,
  cotitular = null,
  arras_previas = 0,
  recibo_arras = null,
  arras_dm_id = null,
  cuota_inicial_hoy = 0,
  precio_venta,
  fecha_venta,
  fecha_pago_inicial,
  medio_pago = 'TRANSFERENCIA',
  banco = '',
  referencia = '',
  plazo_cuotas = 24,
  dias_pago = '15',
  fecha_primera_cuota,
  valor_cuota = 0,
  cuotas = [],
  vendedor_nombre = '',
  comision_vendedor = 0,
  cedula_catastral = '00-00-00-00-0017-0183-0-00-00-0000',
  matricula_inmobiliaria = '232-62531',
  observacion = '',
  usuario = {},
}) {
  const cli = await resolveOrCreateCliente(cliente);
  const arrasAmt = Number(arras_previas) || 0;
  const hoyAmt = Number(cuota_inicial_hoy) || 0;
  const inicialTotal = arrasAmt + hoyAmt;

  let reciboInicial = null;
  const dbClient = supabaseAdmin || supabase;

  if (hoyAmt > 0) {
    const numRec = await obtenerSiguienteNumeroRecibo();
    reciboInicial = {
      numero_recibo: numRec,
      recibo_numero: numRec,
      pagado_a: 'PROYECTO CAMPESTRE LA CEIBA',
      ciudad: 'Acacías',
      estado: 'CUOTA_INICIAL',
      estado_recibo: 'CUOTA_INICIAL',
      lote_id: lote.id,
      lote_id_str: lote.id_lote,
      cliente_id: cli.id,
      cliente_nombre: cli.nombre,
      cliente_doc: cli.doc_cliente,
      fecha_pago: fecha_pago_inicial || fecha_venta || new Date().toISOString().slice(0, 10),
      valor: hoyAmt,
      valor_pagado: hoyAmt,
      valor_letras: numeroALetrasCOP(hoyAmt),
      concepto: arrasAmt > 0
        ? `Saldo Cuota Inicial (Arras previas Recibo #${recibo_arras || '-'}) - ${lote.id_lote}`
        : `Cuota Inicial - ${lote.id_lote}`,
      medio_pago,
      banco,
      referencia_pago: referencia,
      referencia,
      observaciones: observacion || `Contrato formalizado para ${lote.id_lote}`,
      registrado_por: usuario?.nombre || 'Secretaría',
      created_at: new Date().toISOString(),
    };

    await dbClient.from('datos_maestros').insert({
      tipo: 'RECIBO_CAJA',
      orden: numRec,
      valor: JSON.stringify(reciboInicial),
    });
  }

  // Registrar venta completa y generar cuotas
  const venta = await registrarVentaCompleta({
    lote,
    cliente: cli,
    vendedor_nombre: vendedor_nombre || 'DIRECTO',
    comision_vendedor,
    precio_venta,
    valor_cuota_inicial: inicialTotal,
    fecha_pago_cuota_inicial: fecha_pago_inicial || fecha_venta,
    medio_pago,
    fecha_venta,
    plazo_cuotas,
    dias_pago,
    valor_cuota,
    cuotas,
    observacion: arrasAmt > 0
      ? `Contrato generado (Arras previas $${arrasAmt.toLocaleString('es-CO')}${recibo_arras ? ` Recibo #${recibo_arras}` : ''} + Cuota inicial hoy $${hoyAmt.toLocaleString('es-CO')}). ${observacion || ''}`
      : observacion,
  });

  // Marcar contrato = SI en lotes
  await supabase
    .from('lotes')
    .update({ contrato: 'SI', propietario: cli.nombre })
    .eq('id', lote.id);

  // Cerrar arras activas si existían
  if (arras_dm_id) {
    try {
      const { data: row } = await dbClient.from('datos_maestros').select('valor').eq('id', arras_dm_id).single();
      if (row) {
        const parsed = typeof row.valor === 'string' ? JSON.parse(row.valor) : row.valor;
        parsed.estado = 'CONVERTIDA_A_CONTRATO';
        parsed.venta_id = venta.id;
        await dbClient.from('datos_maestros').update({ valor: JSON.stringify(parsed) }).eq('id', arras_dm_id);
      }
    } catch {}
  }

  // Guardar registro estructurado del contrato
  const contratoData = {
    venta_id: venta.id,
    lote_id: lote.id,
    id_lote: lote.id_lote,
    etapa: lote.etapa || (String(lote.id_lote).startsWith('LC1') ? 1 : 2),
    manzana: lote.manzana,
    lote_num: lote.lote,
    area_m2: lote.area_m2 || 160,
    cliente_id: cli.id,
    cliente_nombre: cli.nombre,
    cliente_doc: cli.doc_cliente,
    cliente_celular: cli.celular || '',
    cliente_ciudad: cli.ciudad || 'Acacías',
    cotitular_nombre: cotitular?.nombre || '',
    cotitular_doc: cotitular?.doc_cliente || '',
    cotitular_ciudad: cotitular?.ciudad || '',
    precio_venta: Number(precio_venta) || 0,
    arras_previas: arrasAmt,
    recibo_arras: recibo_arras || null,
    cuota_inicial_hoy: hoyAmt,
    recibo_inicial: reciboInicial?.numero_recibo || null,
    valor_cuota_inicial: inicialTotal,
    saldo_financiado: Math.max(0, (Number(precio_venta) || 0) - inicialTotal),
    plazo_cuotas: Number(plazo_cuotas) || 0,
    valor_cuota: Number(valor_cuota) || 0,
    dias_pago: String(dias_pago || '15'),
    fecha_venta: fecha_venta || new Date().toISOString().slice(0, 10),
    fecha_primera_cuota: fecha_primera_cuota || (cuotas[0]?.fecha_vencimiento || ''),
    vendedor_nombre: vendedor_nombre || 'DIRECTO',
    cedula_catastral,
    matricula_inmobiliaria,
    observaciones: observacion || '',
    generado_por: usuario?.nombre || 'Secretaría',
    created_at: new Date().toISOString(),
  };

  await dbClient.from('datos_maestros').insert({
    tipo: 'CONTRATO_VENTA',
    orden: Math.floor(Date.now() / 1000),
    valor: JSON.stringify(contratoData),
  });

  clearRecibosCache();
  clearCarteraCache();

  return { venta, reciboInicial, contratoData, cliente: cli };
}

/**
 * Obtiene los datos del contrato para "Ver Contrato" y "Descargar PDF"
 * (si no hay CONTRATO_VENTA guardado, lo construye desde la venta/cliente/lote existentes).
 */
export async function obtenerContratoPorLoteOVenta({ lote, venta, cliente }) {
  const ventaId = venta?.id || venta?.venta_id;
  const loteId = lote?.id || venta?.lote_id;

  try {
    const dbClient = supabaseAdmin || supabase;
    const { data } = await dbClient
      .from('datos_maestros')
      .select('valor')
      .eq('tipo', 'CONTRATO_VENTA')
      .order('orden', { ascending: false });

    const match = (data || []).find(r => {
      try {
        const v = typeof r.valor === 'string' ? JSON.parse(r.valor) : r.valor;
        return (ventaId && v.venta_id === ventaId) || (loteId && v.lote_id === loteId);
      } catch {
        return false;
      }
    });
    if (match) {
      return typeof match.valor === 'string' ? JSON.parse(match.valor) : match.valor;
    }
  } catch (e) {
    console.warn('Error leyendo CONTRATO_VENTA:', e);
  }

  // Fallback estructurado desde venta + lote + cliente
  const lObj = lote || venta?.lotes || {};
  const cObj = cliente || venta?.clientes || {};
  const idLote = lObj.id_lote || venta?.id_lote || '';
  return {
    venta_id: ventaId || null,
    lote_id: loteId || null,
    id_lote: idLote,
    etapa: lObj.etapa || (String(idLote).startsWith('LC1') ? 1 : 2),
    manzana: lObj.manzana || (idLote.split('-')[1] || '').trim(),
    lote_num: lObj.lote || (idLote.split('-')[2] || '').trim(),
    area_m2: lObj.area_m2 || 160,
    cliente_nombre: cObj.nombre || venta?.cliente_nombre || lObj.propietario || 'POR DEFINIR',
    cliente_doc: cObj.doc_cliente || '',
    cliente_celular: cObj.celular || '',
    cliente_ciudad: cObj.ciudad || 'Acacías',
    precio_venta: Number(venta?.precio_venta || lObj.precio_venta || lObj.precio_lote) || 0,
    arras_previas: 0,
    valor_cuota_inicial: Number(venta?.valor_cuota_inicial) || 0,
    saldo_financiado: Number(venta?.saldo_financiado) || Math.max(0, (Number(venta?.precio_venta) || 0) - (Number(venta?.valor_cuota_inicial) || 0)),
    plazo_cuotas: Number(venta?.plazo_cuotas) || 24,
    valor_cuota: Number(venta?.valor_cuota) || 0,
    dias_pago: String(venta?.dias_pago || '15').replace(/\D/g, '') || '15',
    fecha_venta: venta?.fecha_venta || new Date().toISOString().slice(0, 10),
    fecha_primera_cuota: '',
    vendedor_nombre: venta?.vendedor_nombre || 'DIRECTO',
    cedula_catastral: '00-00-00-00-0017-0183-0-00-00-0000',
    matricula_inmobiliaria: '232-62531',
    observaciones: lObj.observacion || '',
  };
}

/**
 * Paso de Reversión (Desistimiento / Devolver a Disponible):
 * - Guarda un snapshot completo en DESISTIMIENTO_HISTORIAL (para consulta futura incluso en EstadoCuentaMatrizView)
 * - Conserva los recibos oficiales intactos en RECIBO_CAJA para no perder el consecutivo contable
 * - Elimina cuotas/venta activa del lote y lo devuelve limpio a DISPONIBLE
 */
export async function liberarLoteADisponible({
  lote,
  venta = null,
  cuotas = [],
  recibos = [],
  motivo = '',
  resolucion_dinero = 'No devolutivo / Desistimiento',
  usuario = {},
}) {
  if (!lote?.id) throw new Error('Lote inválido.');
  if (!motivo.trim()) throw new Error('Debes indicar el motivo de la liberación / desistimiento.');

  const dbClient = supabaseAdmin || supabase;
  const ventaId = venta?.id || venta?.venta_id || null;

  // Cargar datos completos si no vinieron completos
  let cuotasSnap = cuotas;
  if (ventaId && (!cuotasSnap || cuotasSnap.length === 0)) {
    const { data: cData } = await supabase.from('cuotas').select('*').eq('venta_id', ventaId).order('numero_cuota');
    cuotasSnap = cData || [];
  }

  const cuotasPagadasAmt = (cuotasSnap || []).reduce((acc, c) => acc + (Number(c.valor_pagado) || 0), 0);
  const inicialAmt = Number(venta?.valor_cuota_inicial) || 0;
  const arrasActiva = await obtenerArrasActiva(lote);
  const totalQuitado = cuotasPagadasAmt + inicialAmt + (venta ? 0 : (Number(arrasActiva?.valor_arras) || 0));

  const snapshot = {
    id: `desist_${Date.now()}`,
    lote_id: lote.id,
    id_lote: lote.id_lote,
    estado_anterior: lote.estado,
    fecha_liberacion: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString(),
    motivo: motivo.trim(),
    resolucion_dinero,
    usuario_nombre: usuario?.nombre || 'Secretaría',
    usuario_rol: usuario?.rol || '',
    cliente_nombre: venta?.cliente_nombre || venta?.clientes?.nombre || arrasActiva?.cliente_nombre || lote.propietario || 'Sin titular',
    cliente_doc: venta?.clientes?.doc_cliente || arrasActiva?.cliente_doc || '',
    valor_quitado: totalQuitado,
    venta_snapshot: venta ? {
      ...venta,
      id_lote: lote.id_lote,
      cliente_nombre: venta?.cliente_nombre || venta?.clientes?.nombre || lote.propietario || '',
      clientes: venta?.clientes || { nombre: lote.propietario || '', doc_cliente: '' },
      lotes: lote,
    } : null,
    cuotas_snapshot: cuotasSnap || [],
    recibos_snapshot: recibos || [],
    arras_snapshot: arrasActiva || null,
  };

  // 1. Guardar en histórico inmutable
  await dbClient.from('datos_maestros').insert({
    tipo: 'DESISTIMIENTO_HISTORIAL',
    orden: Math.floor(Date.now() / 1000),
    valor: JSON.stringify(snapshot),
  });

  // 2. Marcar arras activa como LIBERADA si existe
  if (arrasActiva?.dm_id) {
    const { data: row } = await dbClient.from('datos_maestros').select('valor').eq('id', arrasActiva.dm_id).single();
    if (row) {
      const parsed = typeof row.valor === 'string' ? JSON.parse(row.valor) : row.valor;
      parsed.estado = 'LIBERADA';
      parsed.motivo_liberacion = motivo.trim();
      await dbClient.from('datos_maestros').update({ valor: JSON.stringify(parsed) }).eq('id', arrasActiva.dm_id);
    }
  }

  // 3. Limpiar venta y cuotas activas (NO se borran recibos de RECIBO_CAJA para no perder el consecutivo contable)
  if (ventaId) {
    await dbClient.from('cuotas').delete().eq('venta_id', ventaId);
    await dbClient.from('ventas').delete().eq('id', ventaId);
  } else {
    // Por si quedaron ventas huérfanas ligadas a lote_id
    const { data: orphanVentas } = await dbClient.from('ventas').select('id').eq('lote_id', lote.id);
    for (const ov of orphanVentas || []) {
      await dbClient.from('cuotas').delete().eq('venta_id', ov.id);
      await dbClient.from('ventas').delete().eq('id', ov.id);
    }
  }

  // 4. Devolver lote limpio a DISPONIBLE
  const { error: updErr } = await supabase
    .from('lotes')
    .update({
      estado: 'DISPONIBLE',
      contrato: 'NO',
      propietario: null,
      observacion: `Disponible (liberado el ${snapshot.fecha_liberacion} · Motivo: ${motivo.trim()})`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lote.id);
  if (updErr) throw new Error(`Error liberando lote: ${updErr.message}`);

  await registrarAccion({
    modulo: 'LOTES_DESISTIMIENTO',
    accion: 'LIBERAR_LOTE_DISPONIBLE',
    lote_id_str: lote.id_lote,
    lote_id: lote.id,
    cliente_nombre: snapshot.cliente_nombre,
    usuario,
    descripcion: `Lote ${lote.id_lote} devuelto a DISPONIBLE (Anterior: ${snapshot.cliente_nombre}, Valor histórico: $${totalQuitado.toLocaleString('es-CO')}). Motivo: ${motivo.trim()}`,
    detalles: { valor_quitado: totalQuitado, resolucion_dinero, motivo: motivo.trim() },
  });

  clearCarteraCache();
  clearRecibosCache();
  return snapshot;
}

/**
 * Obtiene el histórico de desistimientos / liberaciones de un lote
 */
export async function obtenerHistorialDesistimientos(loteId) {
  if (!loteId) return [];
  try {
    const dbClient = supabaseAdmin || supabase;
    const { data, error } = await dbClient
      .from('datos_maestros')
      .select('id, orden, valor')
      .eq('tipo', 'DESISTIMIENTO_HISTORIAL')
      .order('orden', { ascending: false });

    if (error || !data) return [];
    return data
      .map(r => {
        try {
          const parsed = typeof r.valor === 'string' ? JSON.parse(r.valor) : r.valor;
          return { dm_id: r.id, ...parsed };
        } catch {
          return null;
        }
      })
      .filter(item => item && item.lote_id === loteId);
  } catch {
    return [];
  }
}
