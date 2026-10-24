import * as sbModule from '../supabase.js';
const supabase = sbModule.supabase;
const supabaseAdmin = sbModule.supabaseAdmin || sbModule.supabase;
import { numeroALetrasCOP } from '../../utils/numeroALetras';
import { registrarAccion } from './auditApi';
import { clearCarteraCache } from './cartera';

const CONSECUTIVO_INICIAL = 3412;
const LOCAL_STORAGE_KEY = 'ceiba_recibos_caja';

// Cache en memoria para recibos (TTL 15s)
let recibosCache = null;
let recibosCacheTime = 0;

export const clearRecibosCache = () => {
  recibosCache = null;
  recibosCacheTime = 0;
  clearCarteraCache();
};

const sanitizarNombreSecretaria = (str) => {
  if (!str) return 'Secretaría';
  return String(str).trim();
};

/**
 * Lee los recibos guardados en el almacenamiento del navegador.
 */
const obtenerRecibosLocales = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    let modificado = false;
    // Limpieza de seguridad: filtrar recibos de pruebas de desarrollo huérfanos o con lote TEST
    const filtrados = list.filter(r => {
      const num = Number(r.numero_recibo);
      if (String(r.lote_id_str || '').toUpperCase().includes('TEST')) return false;
      // Limpieza de prueba previa: si hay un 3412 guardado en local que no sea del lote real (LC2 - 32 - 7)
      if (num === 3412 && !String(r.lote_id_str || '').toUpperCase().includes('32')) return false;
      return true;
    });

    if (filtrados.length !== list.length || modificado) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtrados));
    }
    return filtrados;
  } catch (e) {
    return [];
  }
};

/**
 * Persiste un recibo de caja en el almacenamiento local.
 */
const guardarReciboLocal = (recibo) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const list = obtenerRecibosLocales();
    const idx = list.findIndex(r => Number(r.numero_recibo) === Number(recibo.numero_recibo));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...recibo };
    } else {
      list.unshift(recibo);
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 1000)));
  } catch (e) {
    console.warn('Aviso guardando recibo local:', e);
  }
};

/**
 * Obtiene el siguiente número de recibo consecutivo autoincrementable.
 * Inicia en 3175 si no existen recibos previos.
 */
export const obtenerSiguienteNumeroRecibo = async () => {
  const recibosOcupados = new Set();
  // La base oficial confirmada: recibo 3436 fue saltado por error en papelería física
  recibosOcupados.add(3436);

  // 1. Verificar recibos en almacenamiento local
  const locales = obtenerRecibosLocales();
  locales.forEach(r => {
    const n = Number(r.numero_recibo || r.recibo_numero);
    if (!isNaN(n) && n > 0) recibosOcupados.add(n);
  });

  // 2. Verificar datos_maestros en Supabase
  try {
    const client = supabaseAdmin || supabase;
    const { data } = await client
      .from('datos_maestros')
      .select('orden, valor')
      .eq('tipo', 'RECIBO_CAJA');

    if (data && data.length > 0) {
      data.forEach(d => {
        const n = Number(d.orden);
        if (!isNaN(n) && n > 0) recibosOcupados.add(n);
        if (d.valor) {
          try {
            const p = typeof d.valor === 'string' ? JSON.parse(d.valor) : d.valor;
            const nr = Number(p.numero_recibo || p.recibo_numero);
            if (!isNaN(nr) && nr > 0) recibosOcupados.add(nr);
          } catch (e) {}
        }
      });
    }
  } catch (err) {
    // Silencioso
  }

  // 3. Verificar en tabla cuotas de Supabase
  try {
    let qCuotas = supabase
      .from('cuotas')
      .select('observacion, comprobante_url');
    if (qCuotas && typeof qCuotas.or === 'function') {
      qCuotas = qCuotas.or('observacion.ilike.%Recibo #%,comprobante_url.ilike.%numero_recibo%');
    }
    if (qCuotas && typeof qCuotas.order === 'function') {
      qCuotas = qCuotas.order('created_at', { ascending: false });
    }
    if (qCuotas && typeof qCuotas.limit === 'function') {
      qCuotas = qCuotas.limit(200);
    }
    const { data: cuotasConRecibos } = await qCuotas;

    if (cuotasConRecibos) {
      cuotasConRecibos.forEach(c => {
        if (c.observacion) {
          const m = c.observacion.match(/Recibo #(\d+)/g);
          if (m) {
            m.forEach(matchStr => {
              const num = parseInt(matchStr.replace('Recibo #', ''), 10);
              if (!isNaN(num) && num > 0) recibosOcupados.add(num);
            });
          }
        }
        if (c.comprobante_url) {
          try {
            const parsed = JSON.parse(c.comprobante_url);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            arr.forEach(item => {
              const n = Number(item.numero_recibo);
              if (!isNaN(n) && n > 0) recibosOcupados.add(n);
            });
          } catch (e) {}
        }
      });
    }
  } catch (e) {
    // Silencioso
  }

  // Buscar el primer número disponible a partir de 3437
  let candidato = 3437;
  while (recibosOcupados.has(candidato)) {
    candidato++;
  }

  return candidato;
};

/**
 * Consulta todos los recibos de caja almacenados (unifica Supabase cuotas, datos_maestros y localStorage).
 */
export const obtenerTodosLosRecibos = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && recibosCache && (now - recibosCacheTime < 15000)) {
    return recibosCache;
  }

  const mapaRecibos = new Map();

  // 1. Cargar desde localStorage
  const locales = obtenerRecibosLocales();
  locales.forEach(r => {
    if (r.numero_recibo) {
      mapaRecibos.set(Number(r.numero_recibo), r);
    }
  });

  // 2. Cargar desde cuotas en Supabase (campo comprobante_url)
  try {
    let q = supabase
      .from('cuotas')
      .select('id, venta_id, numero_cuota, comprobante_url, ventas(id, lotes(id_lote), clientes(nombre, doc_cliente))');

    if (q && typeof q.not === 'function') {
      q = q.not('comprobante_url', 'is', null);
    }

    const { data: cuotasConRecibos } = await q;

    if (cuotasConRecibos) {
      cuotasConRecibos.forEach(c => {
        try {
          const parsed = JSON.parse(c.comprobante_url);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          list.forEach(r => {
            if (r && r.numero_recibo) {
              const fullRecibo = {
                numero_recibo: Number(r.numero_recibo),
                pagado_a: r.pagado_a || 'PROYECTO CAMPESTRE LA CEIBA',
                ciudad: r.ciudad || 'Acacías',
                lote_id_str: r.lote_id_str || c.ventas?.lotes?.id_lote || '',
                cliente_nombre: r.cliente_nombre || c.ventas?.clientes?.nombre || '',
                cliente_doc: r.cliente_doc || c.ventas?.clientes?.doc_cliente || '',
                venta_id: r.venta_id || c.venta_id,
                cuota_id: r.cuota_id || c.id,
                numero_cuota: r.numero_cuota || c.numero_cuota,
                fecha_pago: r.fecha_pago || (r.created_at ? r.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                valor: Number(r.valor) || 0,
                valor_letras: r.valor_letras || numeroALetrasCOP(Number(r.valor) || 0),
                medio_pago: r.medio_pago || 'TRANSFERENCIA',
                banco: r.banco || '',
                referencia: r.referencia || r.referencia_pago || '',
                es_pago_completo: Boolean(r.es_pago_completo),
                concepto: r.concepto || (r.numero_cuota ? `Pago Cuota #${r.numero_cuota}` : 'Abono a contrato'),
                observaciones: r.observaciones || (r.medio_pago === 'TRANSFERENCIA' ? `Transferencia a cuenta ${r.banco || 'Bancolombia'}${r.referencia ? ` · Ref: ${r.referencia}` : ''}` : 'Pago en Efectivo'),
                created_at: r.created_at || null,
                hora: r.hora || r.hora_pago || null,
                ...r
              };
              if (!fullRecibo.cliente_nombre) fullRecibo.cliente_nombre = c.ventas?.clientes?.nombre || '';
              if (!fullRecibo.cliente_doc) fullRecibo.cliente_doc = c.ventas?.clientes?.doc_cliente || '';
              if (!fullRecibo.lote_id_str) fullRecibo.lote_id_str = c.ventas?.lotes?.id_lote || '';
              if (!fullRecibo.pagado_a) fullRecibo.pagado_a = 'PROYECTO CAMPESTRE LA CEIBA';
              if (!fullRecibo.ciudad) fullRecibo.ciudad = 'Acacías';
              if (!fullRecibo.concepto) fullRecibo.concepto = `Abono a cuota #${c.numero_cuota || ''}`;
              if (!fullRecibo.observaciones) fullRecibo.observaciones = `Medio de pago: ${fullRecibo.medio_pago || 'Transferencia'}`;
              mapaRecibos.set(Number(r.numero_recibo), fullRecibo);
            }
          });
        } catch (e) {}
      });
    }
  } catch (err) {
    console.warn('Aviso cargando recibos desde cuotas:', err);
  }

  // 3. Cargar desde datos_maestros usando supabaseAdmin
  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('datos_maestros')
      .select('id, orden, valor')
      .eq('tipo', 'RECIBO_CAJA')
      .order('orden', { ascending: false });

    if (!error && data) {
      data.forEach(item => {
        try {
          const parsed = typeof item.valor === 'string' ? JSON.parse(item.valor) : item.valor;
          const nr = Number(item.orden || parsed.numero_recibo || parsed.recibo_numero);
          if (nr) {
            const existing = mapaRecibos.get(nr);
            const valNum = Number(parsed.valor ?? parsed.valor_pagado ?? existing?.valor ?? 0);
            const fullRecibo = {
              db_id: item.id,
              numero_recibo: nr,
              recibo_numero: nr,
              pagado_a: parsed.pagado_a || existing?.pagado_a || 'PROYECTO CAMPESTRE LA CEIBA',
              ciudad: parsed.ciudad || existing?.ciudad || 'Acacías',
              lote_id_str: parsed.lote_id_str || existing?.lote_id_str || '',
              cliente_nombre: parsed.cliente_nombre || existing?.cliente_nombre || '',
              cliente_doc: parsed.cliente_doc || parsed.cliente_cedula || existing?.cliente_doc || '',
              cliente_cedula: parsed.cliente_cedula || parsed.cliente_doc || existing?.cliente_doc || '',
              venta_id: parsed.venta_id || existing?.venta_id || null,
              cuota_id: parsed.cuota_id || existing?.cuota_id || null,
              numero_cuota: parsed.numero_cuota || existing?.numero_cuota || null,
              fecha_pago: parsed.fecha_pago || existing?.fecha_pago || (item.created_at ? item.created_at.slice(0, 10) : ''),
              valor: valNum,
              valor_pagado: valNum,
              valor_letras: parsed.valor_letras || existing?.valor_letras || numeroALetrasCOP(valNum),
              medio_pago: parsed.medio_pago || existing?.medio_pago || 'TRANSFERENCIA',
              banco: parsed.banco || existing?.banco || 'Bancolombia',
              referencia: parsed.referencia || parsed.referencia_bancaria || existing?.referencia || '',
              referencia_bancaria: parsed.referencia_bancaria || parsed.referencia || existing?.referencia || '',
              concepto: parsed.concepto || existing?.concepto || (parsed.numero_cuota ? `Pago Cuota #${parsed.numero_cuota}` : 'Abono a contrato'),
              observaciones: parsed.observaciones || existing?.observaciones || '',
              asesor: sanitizarNombreSecretaria(parsed.asesor || parsed.registrado_por || existing?.asesor),
              registrado_por: sanitizarNombreSecretaria(parsed.registrado_por || parsed.asesor || existing?.asesor),
              excluido_cierre: Boolean(parsed.excluido_cierre),
              motivo_exclusion_cierre: parsed.motivo_exclusion_cierre || '',
              ...parsed,
              // aseguramos que los campos unificados sobreescriban cualquier divergencia
              asesor: sanitizarNombreSecretaria(parsed.asesor || parsed.registrado_por || existing?.asesor),
              registrado_por: sanitizarNombreSecretaria(parsed.registrado_por || parsed.asesor || existing?.asesor),
              valor: valNum,
              valor_pagado: valNum,
              cliente_doc: parsed.cliente_doc || parsed.cliente_cedula || existing?.cliente_doc || '',
              referencia: parsed.referencia || parsed.referencia_bancaria || existing?.referencia || '',
              created_at: parsed.created_at || existing?.created_at || null,
              hora: parsed.hora || parsed.hora_pago || existing?.hora || null
            };
            mapaRecibos.set(nr, fullRecibo);
          }
        } catch (e) {}
      });
    }
  } catch (err) {
    // Silencioso
  }

  const recibos = Array.from(mapaRecibos.values())
    .filter(r => {
      // Filtrar recibos huérfanos de lotes de prueba
      if (String(r.lote_id_str || '').toUpperCase().includes('TEST')) return false;
      return true;
    })
    .sort((a, b) => (Number(b.numero_recibo) || 0) - (Number(a.numero_recibo) || 0));

  recibosCache = recibos;
  recibosCacheTime = now;
  return recibos;
};

/**
 * Obtiene los recibos de un contrato/venta específico.
 */
export const obtenerRecibosPorVenta = async (ventaId) => {
  const todos = await obtenerTodosLosRecibos();
  return todos.filter(r => r.venta_id === ventaId);
};

/**
 * Obtiene los recibos aplicados a una cuota específica.
 */
export const obtenerRecibosPorCuota = async (cuotaId) => {
  const todos = await obtenerTodosLosRecibos();
  return todos.filter(r => r.cuota_id === cuotaId);
};

/**
 * Obtiene los recibos dentro de un rango de fechas de pago.
 */
export const obtenerRecibosEnRango = async (desde, hasta) => {
  const todos = await obtenerTodosLosRecibos();
  return todos.filter(r => {
    const fp = r.fecha_pago || (r.created_at ? r.created_at.slice(0, 10) : null);
    if (!fp) return false;
    return fp >= desde && fp <= hasta;
  });
};

/**
 * Guarda un recibo de caja en memoria/local y en Supabase sin fallar por RLS.
 */
export const crearReciboCaja = async (datosRecibo) => {
  const numero_recibo = datosRecibo.numero_recibo || await obtenerSiguienteNumeroRecibo();
  const valorNum = Math.round(Number(datosRecibo.valor) || 0);
  const valor_letras = datosRecibo.valor_letras || numeroALetrasCOP(valorNum);

  const payload = {
    ...datosRecibo,
    numero_recibo,
    pagado_a: 'PROYECTO CAMPESTRE LA CEIBA',
    ciudad: 'Acacías',
    valor: valorNum,
    valor_letras,
    created_at: datosRecibo.created_at || new Date().toISOString()
  };

  // 1. Guardar de forma inmediata en almacenamiento local
  guardarReciboLocal(payload);

  // 2. Guardar en datos_maestros usando supabaseAdmin
  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('datos_maestros')
      .insert([{
        tipo: 'RECIBO_CAJA',
        orden: numero_recibo,
        valor: JSON.stringify(payload)
      }])
      .select()
      .single();

    if (!error && data) {
      payload.db_id = data.id;
    }
  } catch (err) {
    console.warn('Aviso guardando recibo en datos_maestros:', err);
  }

  clearRecibosCache();

  return payload;
};

/**
 * Registra un pago/abono (individual o en cascada multi-cuotas), genera el recibo oficial y actualiza cartera.
 */
export const registrarPagoConRecibo = async ({
  ventaId,
  cuotaId = null,
  afectaciones = null,
  monto,
  fechaPago = new Date().toISOString().slice(0, 10),
  medioPago = 'TRANSFERENCIA',
  banco = '',
  referenciaPago = '',
  concepto = '',
  observaciones = '',
  registradoPor = 'Secretaría',
  ciudad = 'Acacías',
  loteIdStr = '',
  clienteNombre = '',
  clienteDoc = '',
  generarRecibo = true,
  numeroReciboManual = null
}) => {
  const montoNum = Math.round(Number(monto) || 0);
  if (montoNum <= 0) {
    throw new Error('El monto a pagar debe ser mayor a cero.');
  }

  // 0. Intentar ejecución atómica en PostgreSQL (solo si se va a emitir recibo oficial)
  if (generarRecibo) {
    try {
      const valorLetras = numeroALetrasCOP(montoNum);
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('procesar_pago_con_recibo', {
        p_venta_id: ventaId || null,
        p_cuota_id: cuotaId || null,
        p_afectaciones: afectaciones ? JSON.parse(JSON.stringify(afectaciones)) : null,
        p_monto: montoNum,
        p_fecha_pago: fechaPago,
        p_medio_pago: medioPago,
        p_banco: banco || '',
        p_referencia: referenciaPago || '',
        p_concepto: concepto || (cuotaId ? `Abono a cuota` : 'Abono a contrato'),
        p_observaciones: observaciones || '',
        p_registrado_por: sanitizarNombreSecretaria(registradoPor),
        p_ciudad: ciudad || 'Acacías',
        p_lote_id_str: loteIdStr || '',
        p_cliente_nombre: clienteNombre || '',
        p_cliente_doc: clienteDoc || '',
        p_valor_letras: valorLetras
      });

      if (!rpcErr && rpcRes) {
        const reciboEmitido = typeof rpcRes === 'string' ? JSON.parse(rpcRes) : rpcRes;
        guardarReciboLocal(reciboEmitido);
        clearRecibosCache();
        return {
          recibo: reciboEmitido,
          sinRecibo: false,
          cuotaActualizada: null,
          cuotasActualizadas: [],
          transaccionalBackend: true
        };
      }
    } catch (rpcEx) {
      // Si la función RPC aún no está creada en Supabase, continúa con el rollback compensatorio
    }
  }

  // 1. Obtener siguiente número de recibo consecutivo (solo si se genera recibo oficial)
  const numero_recibo = generarRecibo
    ? (Number(numeroReciboManual) > 0 ? Number(numeroReciboManual) : await obtenerSiguienteNumeroRecibo())
    : null;

  let cuotasActualizadas = [];
  let esPagoCompleto = false;
  let saldoRestanteCuota = 0;
  let numeroCuota = null;
  let cuotasInfoStr = '';

  const conceptoFinal = concepto || (
    numeroCuota
      ? `Abono a Cuota #${numeroCuota} - ${loteIdStr || ''} - Titular: ${clienteNombre || ''}`.trim()
      : `Pago / Abono contrato - ${loteIdStr || ''} - Titular: ${clienteNombre || ''}`.trim()
  );

  const obsFinal = observaciones || (
    medioPago === 'TRANSFERENCIA'
      ? `Transferencia a cuenta ${banco || 'Bancolombia'}${referenciaPago ? ` · Ref: ${referenciaPago}` : ''}`
      : `Pago en Efectivo recibido en oficina${referenciaPago ? ` · Ref: ${referenciaPago}` : ''}`
  );

  // 2. CASO A: Múltiples cuotas afectadas en cascada
  if (afectaciones && Array.isArray(afectaciones) && afectaciones.length > 0) {
    const numerosCuotas = afectaciones.map(a => a.numero_cuota);
    numeroCuota = numerosCuotas[0];
    cuotasInfoStr = `Cuotas ${numerosCuotas.join(', ')}`;
    const cuotasCompletadas = afectaciones.filter(a => a.completo);
    const esAbonoMultiples = cuotasCompletadas.length > 1;

    for (let i = 0; i < afectaciones.length; i++) {
      const a = afectaciones[i];
      const { data: cuota, error: cErr } = await supabase
        .from('cuotas')
        .select('*')
        .eq('id', a.id)
        .single();

      if (cuota) {
        let valPagadoActualizar;
        let fechaPagoActualizar;
        let obsCuotaActualizar;
        let estadoCuotaActualizar;

        if (i === 0) {
          // Primera cuota: recibe el monto total si cubre múltiples cuotas completas, o el valor abonado a esta cuota
          valPagadoActualizar = esAbonoMultiples ? montoNum : ((Number(cuota.valor_pagado) || 0) + (Number(a.valor_abono) || 0));
          fechaPagoActualizar = fechaPago;
          const cuotaVal = Number(cuota.valor_cuota) || 0;
          const difCentavos = cuotaVal - valPagadoActualizar;
          const esCompleto = a.completo || valPagadoActualizar >= cuotaVal || (cuotaVal > 0 && difCentavos <= 2000) || (cuotaVal > 0 && (difCentavos / cuotaVal) < 0.02);
          estadoCuotaActualizar = esCompleto ? 'PAGA' : (cuota.estado_cuota === 'VENCIDA' ? 'VENCIDA' : 'AL DÍA');
          if (esCompleto && difCentavos > 0 && difCentavos <= 2000) {
            valPagadoActualizar = cuotaVal;
          }

          const montoFormateado = (esAbonoMultiples ? montoNum : a.valor_abono).toLocaleString('es-CO');
          const notaRecibo = generarRecibo
            ? `Recibo #${numero_recibo} ($${montoFormateado}) el ${fechaPago}`
            : `Abono contable ($${montoFormateado}) el ${fechaPago} (Sin recibo oficial)`;
          const notaCubiertas = esAbonoMultiples
            ? `Abono de $${montoNum.toLocaleString('es-CO')} cubre ${cuotasCompletadas.length} cuotas (cuotas ${cuotasCompletadas[0].numero_cuota} a ${cuotasCompletadas[cuotasCompletadas.length - 1].numero_cuota})`
            : '';
          const partes = [notaCubiertas, notaRecibo, cuota.observacion].filter(Boolean);
          obsCuotaActualizar = partes.join(' | ');
        } else {
          // Cuotas subsecuentes:
          if (a.completo) {
            // Si fue cubierta completamente en el pago agrupado, queda limpia como PAGA ($0 y sin fecha de pago falsa)
            valPagadoActualizar = 0.0;
            fechaPagoActualizar = null;
            estadoCuotaActualizar = 'PAGA';
            obsCuotaActualizar = null;
          } else {
            // Si solo recibió un abono parcial, conserva su valor pagado y estado AL DÍA
            valPagadoActualizar = (Number(cuota.valor_pagado) || 0) + (Number(a.valor_abono) || 0);
            fechaPagoActualizar = fechaPago;
            estadoCuotaActualizar = 'AL DÍA';
            obsCuotaActualizar = `Abono parcial ($${Number(a.valor_abono).toLocaleString('es-CO')}) el ${fechaPago}`;
          }
        }

        let hist = [];
        if (i === 0 && cuota.comprobante_url) {
          try {
            const p = JSON.parse(cuota.comprobante_url);
            hist = Array.isArray(p) ? p : [p];
          } catch (e) {}
        }
        if (i === 0) {
          const entradaHist = {
            fecha_pago: fechaPago,
            valor: montoNum,
            medio_pago: medioPago,
            banco,
            referencia: referenciaPago,
            es_pago_completo: true,
            concepto: conceptoFinal,
            observaciones: obsFinal,
            ciudad: 'Acacías',
            pagado_a: 'PROYECTO CAMPESTRE LA CEIBA',
            lote_id_str: loteIdStr,
            cliente_nombre: clienteNombre,
            cliente_doc: clienteDoc,
            venta_id: ventaId,
            cuota_id: a.id,
            numero_cuota: a.numero_cuota,
            created_at: new Date().toISOString()
          };
          if (generarRecibo) {
            entradaHist.numero_recibo = numero_recibo;
            entradaHist.valor_letras = numeroALetrasCOP(montoNum);
          } else {
            entradaHist.sin_recibo = true;
            entradaHist.tipo = 'PAGO_DIRECTO_SIN_RECIBO';
          }
          hist.push(entradaHist);
        }

        const { data: updated } = await supabase
          .from('cuotas')
          .update({
            valor_pagado: valPagadoActualizar,
            estado_cuota: estadoCuotaActualizar,
            fecha_pago: fechaPagoActualizar,
            medio_pago: medioPago,
            observacion: obsCuotaActualizar,
            comprobante_url: (i === 0) ? JSON.stringify(hist) : null
          })
          .eq('id', a.id)
          .select()
          .single();

        if (updated) cuotasActualizadas.push(updated);
      }
    }

    const ultima = afectaciones[afectaciones.length - 1];
    if (ultima && !ultima.completo) {
      saldoRestanteCuota = Math.max(0, (Number(ultima.valor_cuota) || 0) - (Number(ultima.nuevo_pagado) || 0));
    }
    esPagoCompleto = afectaciones.every(a => a.completo);

  // 2. CASO B: Cuota individual seleccionada
  } else if (cuotaId) {
    const { data: cuota, error: cErr } = await supabase
      .from('cuotas')
      .select('*')
      .eq('id', cuotaId)
      .single();

    if (cErr) throw cErr;

    numeroCuota = cuota.numero_cuota;
    const valCuota = Number(cuota.valor_cuota) || 0;
    const yaPagado = Number(cuota.valor_pagado) || 0;
    const nuevoPagado = yaPagado + montoNum;

    const difCentavos = valCuota - nuevoPagado;
    // Si el monto cubre la cuota o la diferencia es de centavos/redondeo (<= $2.000 COP o < 2%)
    esPagoCompleto = (nuevoPagado >= valCuota) || (valCuota > 0 && difCentavos <= 2000) || (valCuota > 0 && (difCentavos / valCuota) < 0.02);
    saldoRestanteCuota = esPagoCompleto ? 0 : Math.max(0, valCuota - nuevoPagado);

    let nuevoEstado = cuota.estado_cuota;
    if (esPagoCompleto) {
      nuevoEstado = 'PAGA';
    } else {
      nuevoEstado = cuota.estado_cuota === 'VENCIDA' ? 'VENCIDA' : 'AL DÍA';
    }
    const valPagadoFinal = esPagoCompleto && difCentavos > 0 && difCentavos <= 2000 ? valCuota : nuevoPagado;

    const montoFormateado = montoNum.toLocaleString('es-CO');
    const notaRecibo = generarRecibo
      ? `Recibo #${numero_recibo} ($${montoFormateado}) el ${fechaPago}`
      : `Abono contable ($${montoFormateado}) el ${fechaPago} (Sin recibo oficial)`;
    const obsCuota = cuota.observacion
      ? `${cuota.observacion} | ${notaRecibo}`.trim()
      : notaRecibo;

    let historialRecibos = [];
    if (cuota.comprobante_url) {
      try {
        const parsed = JSON.parse(cuota.comprobante_url);
        if (Array.isArray(parsed)) historialRecibos = parsed;
        else if (parsed && typeof parsed === 'object') historialRecibos = [parsed];
      } catch (e) {}
    }
    const entradaHistorialCuota = {
      fecha_pago: fechaPago,
      valor: montoNum,
      medio_pago: medioPago,
      banco,
      referencia: referenciaPago,
      es_pago_completo: esPagoCompleto,
      concepto: conceptoFinal,
      observaciones: obsFinal,
      ciudad: 'Acacías',
      pagado_a: 'PROYECTO CAMPESTRE LA CEIBA',
      lote_id_str: loteIdStr,
      cliente_nombre: clienteNombre,
      cliente_doc: clienteDoc,
      venta_id: ventaId,
      cuota_id: cuotaId,
      numero_cuota: numeroCuota,
      created_at: new Date().toISOString()
    };
    if (generarRecibo) {
      entradaHistorialCuota.numero_recibo = numero_recibo;
      entradaHistorialCuota.valor_letras = numeroALetrasCOP(montoNum);
    } else {
      entradaHistorialCuota.sin_recibo = true;
      entradaHistorialCuota.tipo = 'PAGO_DIRECTO_SIN_RECIBO';
    }
    historialRecibos.push(entradaHistorialCuota);

    const { data: cUpdated, error: uErr } = await supabase
      .from('cuotas')
      .update({
        valor_pagado: valPagadoFinal,
        estado_cuota: nuevoEstado,
        fecha_pago: fechaPago,
        medio_pago: medioPago,
        observacion: obsCuota,
        comprobante_url: JSON.stringify(historialRecibos)
      })
      .eq('id', cuotaId)
      .select()
      .single();

    if (uErr) throw uErr;
    cuotasActualizadas = [cUpdated];
  }

  // 3. Actualizar saldo del contrato / venta
  if (ventaId) {
    try {
      const vFrom = supabase.from('ventas');
      if (vFrom && typeof vFrom.select === 'function') {
        const { data: vActual } = await vFrom
          .select('saldo, abonos')
          .eq('id', ventaId)
          .single();

        if (vActual) {
          const nuevoSaldo = Math.max(0, (Number(vActual.saldo) || 0) - montoNum);
          const nuevosAbonos = (Number(vActual.abonos) || 0) + montoNum;
          if (typeof vFrom.update === 'function') {
            await vFrom
              .update({ saldo: nuevoSaldo, abonos: nuevosAbonos })
              .eq('id', ventaId);
          }
        }
      }

      const { data: todasCuotas } = await supabase
        .from('cuotas')
        .select('estado_cuota, valor_cuota, valor_pagado')
        .eq('venta_id', ventaId);

      const quedanPendientes = (todasCuotas || []).some(
        c => c.estado_cuota !== 'PAGA' || (Number(c.valor_pagado) || 0) < (Number(c.valor_cuota) || 0)
      );

      if (!quedanPendientes && todasCuotas && todasCuotas.length > 0) {
        await supabase.from('ventas').update({ estado: 'PAGADO EN SU TOTALIDAD' }).eq('id', ventaId);
      }
    } catch (e) {
      console.warn('Aviso verificando saldo total del contrato:', e);
    }
  }

  // 5. Crear el recibo oficial (solo si generarRecibo es true)
  let reciboEmitido = null;
  if (generarRecibo) {
    reciboEmitido = await crearReciboCaja({
      numero_recibo,
      pagado_a: 'PROYECTO CAMPESTRE LA CEIBA',
      ciudad: 'Acacías',
      venta_id: ventaId,
      cuota_id: cuotaId,
      numero_cuota: numeroCuota,
      afectaciones: afectaciones || undefined,
      lote_id_str: loteIdStr,
      cliente_nombre: clienteNombre,
      cliente_doc: clienteDoc,
      fecha_pago: fechaPago,
      valor: montoNum,
      valor_letras: numeroALetrasCOP(montoNum),
      concepto: conceptoFinal,
      medio_pago: medioPago,
      banco: banco || undefined,
      referencia_pago: referenciaPago || undefined,
      observaciones: obsFinal,
      es_pago_completo: esPagoCompleto,
      saldo_restante_cuota: saldoRestanteCuota,
      registrado_por: registradoPor
    });
  }

  // 6. Auditoría
  try {
    const nombreAudit = registradoPor || 'Secretaría';
    const esDianaSoporte = nombreAudit === 'Diana (Soporte)' || nombreAudit === 'Soporte Mora';
    await registrarAccion({
      modulo: generarRecibo ? 'RECIBOS_CAJA' : 'CARTERA',
      accion: generarRecibo ? 'EMISION_RECIBO_PAGO' : 'PAGO_REGISTRADO_SIN_RECIBO',
      lote_id_str: loteIdStr || `Venta #${ventaId}`,
      cliente_nombre: clienteNombre || '—',
      descripcion: generarRecibo
        ? `Emisión de Recibo Oficial #${numero_recibo} por $${montoNum.toLocaleString('es-CO')} (${conceptoFinal}) a nombre de ${clienteNombre || 'Cliente'}`
        : `Registro de abono contable sin recibo oficial por $${montoNum.toLocaleString('es-CO')} (${conceptoFinal}) a nombre de ${clienteNombre || 'Cliente'}`,
      detalles: {
        numero_recibo: generarRecibo ? numero_recibo : null,
        monto: montoNum,
        medio_pago: medioPago,
        banco: banco || undefined,
        referencia_pago: referenciaPago || undefined,
        fecha_pago: fechaPago,
        concepto: conceptoFinal,
        observaciones: obsFinal,
        sin_recibo: !generarRecibo
      },
      usuario: {
        nombre: nombreAudit,
        email: esDianaSoporte ? 'soporte@ceiba.com' : 'secretaria@ceiba.com',
        role: esDianaSoporte ? 'soporte' : 'secretaria'
      }
    });
  } catch (errLog) {
    console.warn('Aviso registrando auditoría de recibo:', errLog);
  }

  return {
    recibo: reciboEmitido,
    sinRecibo: !generarRecibo,
    cuotaActualizada: cuotasActualizadas[0] || null,
    cuotasActualizadas
  };
};

/**
 * Anula un recibo de caja existente con justificación requerida y auditoría.
 * Restringido a Contadora y Administrador (Secretaría no tiene permiso de anulación ni borrado).
 */
export const anularRecibo = async ({
  numeroRecibo,
  motivo,
  usuarioActual = 'Contadora',
  rolUsuario = 'contadora'
}) => {
  if (rolUsuario === 'secretaria') {
    throw new Error('Permiso denegado: El rol de Secretaría no puede anular ni eliminar recibos de pago. Debe solicitar la anulación a la Contadora o al Administrador.');
  }

  if (!motivo || !motivo.trim()) {
    throw new Error('Debe especificar un motivo justificado para anular el recibo.');
  }

  const numRec = Number(numeroRecibo);

  // 0. Intentar ejecución atómica en PostgreSQL (RPC ACID)
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('anular_recibo_oficial', {
      p_numero_recibo: numRec,
      p_motivo: motivo.trim(),
      p_usuario_actual: usuarioActual,
      p_rol_usuario: rolUsuario
    });

    if (!rpcErr && rpcRes) {
      const reciboAnuladoRpc = typeof rpcRes === 'string' ? JSON.parse(rpcRes) : rpcRes;
      guardarReciboLocal(reciboAnuladoRpc);
      clearRecibosCache();
      return reciboAnuladoRpc;
    }
  } catch (rpcEx) {
    // Continúa con la lógica cliente si no existe la función
  }

  const todos = await obtenerTodosLosRecibos(true);
  const recibo = todos.find(r => Number(r.numero_recibo) === numRec);

  if (!recibo) {
    throw new Error(`No se encontró el recibo de caja #${numeroRecibo}.`);
  }

  if (recibo.anulado) {
    throw new Error(`El recibo de caja #${numeroRecibo} ya se encuentra anulado.`);
  }

  const reciboAnulado = {
    ...recibo,
    anulado: true,
    motivo_anulacion: motivo.trim(),
    anulado_por: usuarioActual,
    anulado_at: new Date().toISOString()
  };

  // 1. Actualizar en localStorage
  guardarReciboLocal(reciboAnulado);

  // 2. Si existe en datos_maestros, actualizar con supabaseAdmin
  try {
    const client = supabaseAdmin || supabase;
    if (recibo.db_id) {
      await client
        .from('datos_maestros')
        .update({
          valor: JSON.stringify(reciboAnulado)
        })
        .eq('id', recibo.db_id);
    } else {
      await client
        .from('datos_maestros')
        .update({
          valor: JSON.stringify(reciboAnulado)
        })
        .eq('tipo', 'RECIBO_CAJA')
        .eq('orden', numRec);
    }
  } catch (errDb) {
    console.warn('Aviso actualizando recibo anulado en BD:', errDb);
  }

  // 3. Revertir saldo en venta si aplica
  if (recibo.venta_id && recibo.valor) {
    try {
      const { data: v } = await supabase
        .from('ventas')
        .select('saldo, abonos')
        .eq('id', recibo.venta_id)
        .single();

      if (v) {
        const saldoRevertido = (Number(v.saldo) || 0) + Number(recibo.valor);
        const abonosRevertidos = Math.max(0, (Number(v.abonos) || 0) - Number(recibo.valor));
        await supabase
          .from('ventas')
          .update({ saldo: saldoRevertido, abonos: abonosRevertidos, estado: 'ACTIVA' })
          .eq('id', recibo.venta_id);
      }
    } catch (e) {
      console.warn('Aviso revirtiendo saldo de venta:', e);
    }
  }

  // 4. Revertir en cuota si aplica
  if (recibo.cuota_id && recibo.valor) {
    try {
      const { data: c } = await supabase
        .from('cuotas')
        .select('*')
        .eq('id', recibo.cuota_id)
        .single();

      if (c) {
        const nuevoPagado = Math.max(0, (Number(c.valor_pagado) || 0) - Number(recibo.valor));
        const valCuota = Number(c.valor_cuota) || 0;
        const estadoRestaurado = nuevoPagado >= valCuota ? 'PAGA' : 'VENCIDA';

        let hist = [];
        if (c.comprobante_url) {
          try {
            const p = JSON.parse(c.comprobante_url);
            hist = (Array.isArray(p) ? p : [p]).map(item => {
              if (Number(item.numero_recibo) === numRec) {
                return { ...item, anulado: true, motivo_anulacion: motivo };
              }
              return item;
            });
          } catch (e) {}
        }

        await supabase
          .from('cuotas')
          .update({
            valor_pagado: valPagadoFinal,
            estado_cuota: estadoRestaurado,
            comprobante_url: JSON.stringify(hist),
            observacion: `${c.observacion || ''} | [ANULADO Recibo #${numRec}]`.trim()
          })
          .eq('id', recibo.cuota_id);
      }
    } catch (e) {
      console.warn('Aviso revirtiendo cuota:', e);
    }
  }

  clearRecibosCache();

  // 5. Auditoría
  try {
    await registrarAccion({
      modulo: 'RECIBOS_CAJA',
      accion: 'ANULACION_RECIBO',
      lote_id_str: recibo.lote_id_str || `Recibo #${numRec}`,
      descripcion: `Anulación de Recibo #${numRec} por ${usuarioActual} (${rolUsuario}). Motivo: ${motivo.trim()}`
    });
  } catch (eAudit) {
    console.warn('Aviso auditoría anulación:', eAudit);
  }

  return reciboAnulado;
};


