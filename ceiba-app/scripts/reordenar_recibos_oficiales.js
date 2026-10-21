import { createClient } from '@supabase/supabase-js';
import { numeroALetrasCOP } from '../src/utils/numeroALetras.js';

const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const PAGOS_ORDENADOS = [
  // 19 de Octubre de 2026 (En orden de escritura en Excel, iniciando en #3398 como corte acordado)
  {
    reciboNum: 3398,
    loteIdStr: 'LC1 - 11 - 2',
    cuotaNum: 10,
    monto: 875000,
    fechaPago: '2026-10-19',
    clienteNombre: 'CESAR AUGUSTO LOPEZ BUITRAGO',
    excluidoCierre: true,
    motivoExclusion: 'Pago previo ya dejado en corte anterior. Estadística entra desde recibo #3399.'
  },
  {
    reciboNum: 3399,
    loteIdStr: 'LC1 - 4 - 1',
    cuotaNum: 5,
    monto: 1640800,
    fechaPago: '2026-10-19',
    clienteNombre: 'MARIA YOLANDA CARACAS LEÓN'
  },
  {
    reciboNum: 3400,
    loteIdStr: 'LC1 - 13 - 2 - 3 - 4 Y 5',
    cuotaNum: 21,
    monto: 1575000,
    fechaPago: '2026-10-19',
    clienteNombre: 'ADOLFO PORRAS GAVANZO'
  },
  {
    reciboNum: 3401,
    loteIdStr: 'LC1 - 15 - 8',
    cuotaNum: 9,
    monto: 875000,
    fechaPago: '2026-10-19',
    clienteNombre: 'MARIA YOLANDA CARACAS LEON / JORGE EDGAR GOMEZ'
  },
  {
    reciboNum: 3402,
    loteIdStr: 'LC1 - 21 - 4',
    cuotaNum: 10,
    monto: 1083000,
    fechaPago: '2026-10-19',
    clienteNombre: 'NURY JULIETH RODRIGUEZ CASTILLO'
  },
  {
    reciboNum: 3403,
    loteIdStr: 'LC2 - 33 - 12',
    cuotaNum: 9,
    monto: 1000000,
    fechaPago: '2026-10-19',
    clienteNombre: 'SANDRA PATRICIA ESCOBAR CABALLERO'
  },
  {
    reciboNum: 3404,
    loteIdStr: 'LC2 - 35 - 9',
    cuotaNum: 6,
    monto: 1000000,
    fechaPago: '2026-10-19',
    clienteNombre: 'DIANA MARCELA HERRERA RODRIGUEZ'
  },
  {
    reciboNum: 3405,
    loteIdStr: 'LC2 - 37 - 11',
    cuotaNum: 5,
    monto: 1000000,
    fechaPago: '2026-10-19',
    clienteNombre: 'RUBEN DARIO REYES MARTIN'
  },

  // 20 de Octubre de 2026 (En orden de escritura en Excel)
  {
    reciboNum: 3406,
    loteIdStr: 'LC1 - 3 - 9',
    cuotaNum: 14,
    monto: 875000,
    fechaPago: '2026-10-20',
    clienteNombre: 'LUISA FERNANDA GOMEZ CARRERO / JUAN DAVID REY'
  },
  {
    reciboNum: 3407,
    loteIdStr: 'LC1 - 5 - 6',
    cuotaNum: 8,
    monto: 1231000,
    fechaPago: '2026-10-20',
    clienteNombre: 'MILENA JOHANNA COCA MEJIA / YEISON ALBERTO MONROY'
  },
  {
    reciboNum: 3408,
    loteIdStr: 'LC1 - 13 - 8',
    cuotaNum: 15,
    monto: 800000,
    fechaPago: '2026-10-20',
    clienteNombre: 'AURORA LUCIA PAEZ CALDERON'
  },
  {
    reciboNum: 3409,
    loteIdStr: 'LC2 - 31 - 1 - 2 - 11 Y 12',
    cuotaNum: 16,
    monto: 3416800,
    fechaPago: '2026-10-20',
    clienteNombre: 'TULIA ETELVINA VELASQUEZ RODRIGUEZ'
  },
  {
    reciboNum: 3410,
    loteIdStr: 'LC2 - 35 - 6',
    cuotaNum: 8,
    monto: 1126300,
    fechaPago: '2026-10-20',
    clienteNombre: 'RUTH DENIS ALVAREZ BUITRAGO'
  },
  {
    reciboNum: 3411,
    loteIdStr: 'LC2 - 47 - 2',
    cuotaNum: 6,
    monto: 1000000,
    fechaPago: '2026-10-20',
    clienteNombre: 'DORA EMILCE CASAS GONZALEZ / JAVIER ERNESTO VIDARTE PENNA'
  },

  // 21 de Octubre de 2026 (En orden de escritura en Excel)
  {
    reciboNum: 3412,
    loteIdStr: 'LC2 - 42 - 5',
    cuotaNum: 4,
    monto: 1000000,
    fechaPago: '2026-10-21',
    clienteNombre: 'JOSE ISBELIO RAMIREZ CORTES'
  }
];

async function main() {
  console.log('========================================================================');
  console.log('REORDENAMIENTO DEFINITIVO DE RECIBOS SEGÚN ESCRITURA EN EXCEL');
  console.log('========================================================================\n');

  // 1. Limpiar datos_maestros de RECIBO_CAJA y AUDITORIA_ACCION
  await supabase.from('datos_maestros').delete().eq('tipo', 'RECIBO_CAJA');
  await supabase.from('datos_maestros').delete().eq('tipo', 'AUDITORIA_ACCION');
  console.log('1. Tablas datos_maestros limpiadas para regeneración ordenada...');

  // 2. Normalizar Cuota #3 de LC2 - 42 - 5
  const venta42_5Id = 'd02fd88d-4f7f-4751-8292-d27d26f37e5b';
  await supabase
    .from('cuotas')
    .update({
      fecha_pago: '2026-09-21',
      valor_pagado: 1000000.0,
      estado_cuota: 'PAGA',
      medio_pago: 'TRANSFERENCIA',
      observacion: 'Pago registrado en extracto / Excel anterior'
    })
    .eq('venta_id', venta42_5Id)
    .eq('numero_cuota', 3);

  // 3. Procesar los 15 pagos en orden
  for (const item of PAGOS_ORDENADOS) {
    const { reciboNum, loteIdStr, cuotaNum, monto, fechaPago, clienteNombre, excluidoCierre, motivoExclusion } = item;

    // Buscar lote
    let { data: lotes } = await supabase
      .from('lotes')
      .select('id, id_lote')
      .eq('id_lote', loteIdStr);

    if (!lotes || lotes.length === 0) {
      const searchPat = loteIdStr.replace(/\s+/g, '%');
      const { data: lotesFuzzy } = await supabase
        .from('lotes')
        .select('id, id_lote')
        .ilike('id_lote', `%${searchPat}%`);
      lotes = lotesFuzzy;
    }

    const lote = lotes[0];
    const loteId = lote.id;

    // Buscar venta
    const { data: ventas } = await supabase
      .from('ventas')
      .select('id, saldo, abonos, clientes(nombre, doc_cliente)')
      .eq('lote_id', loteId);

    const venta = ventas[0];
    const ventaId = venta.id;
    const finalClienteNombre = clienteNombre || venta.clientes?.nombre || 'Titular';
    const finalClienteDoc = venta.clientes?.doc_cliente || '';

    // Buscar cuota
    const { data: cuotas } = await supabase
      .from('cuotas')
      .select('id')
      .eq('venta_id', ventaId)
      .eq('numero_cuota', cuotaNum);

    const cuota = cuotas[0];
    const cuotaId = cuota.id;

    const valorLetras = numeroALetrasCOP(monto);
    const concepto = `Pago Cuota #${cuotaNum} - ${lote.id_lote} - Titular: ${finalClienteNombre}`;
    const observaciones = 'Transferencia a cuenta Bancolombia verificada en extracto';

    const reciboPayload = {
      numero_recibo: reciboNum,
      pagado_a: 'PROYECTO CAMPESTRE LA CEIBA',
      ciudad: 'Acacías',
      lote_id_str: lote.id_lote,
      cliente_nombre: finalClienteNombre,
      cliente_doc: finalClienteDoc,
      venta_id: ventaId,
      cuota_id: cuotaId,
      numero_cuota: cuotaNum,
      fecha_pago: fechaPago,
      valor: monto,
      valor_letras: valorLetras,
      medio_pago: 'TRANSFERENCIA',
      banco: 'Bancolombia',
      referencia: 'TRANSF-VERIFICADA',
      es_pago_completo: true,
      saldo_restante_cuota: 0,
      excluido_cierre: !!excluidoCierre,
      motivo_exclusion_cierre: motivoExclusion || undefined,
      concepto,
      observaciones,
      registrado_por: 'Tatiana (Secretaría)',
      created_at: `${fechaPago}T11:00:00.000Z`
    };

    // 1. Guardar RECIBO_CAJA
    const { data: dmRecibo } = await supabase
      .from('datos_maestros')
      .insert({
        tipo: 'RECIBO_CAJA',
        orden: reciboNum,
        valor: JSON.stringify(reciboPayload)
      })
      .select()
      .single();

    reciboPayload.db_id = dmRecibo?.id;

    // 2. Guardar AUDITORIA_ACCION
    const auditRecord = {
      id: `log_${Date.now()}_${reciboNum}`,
      timestamp: `${fechaPago}T11:00:00.000Z`,
      modulo: 'RECIBOS_CAJA',
      accion: 'EMISION_RECIBO_PAGO',
      lote_id_str: lote.id_lote,
      lote_id: loteId,
      cliente_nombre: finalClienteNombre,
      usuario_email: 'secretaria@laceiba.com',
      usuario_nombre: 'Tatiana (Secretaría)',
      usuario_rol: 'secretaria',
      descripcion: `Emisión de Recibo Oficial #${reciboNum} por $${monto.toLocaleString('es-CO')} (${concepto}) a nombre de ${finalClienteNombre}`,
      detalles: {
        numero_recibo: reciboNum,
        cuota_id: cuotaId,
        numero_cuota: cuotaNum,
        monto: monto,
        medio_pago: 'TRANSFERENCIA',
        banco: 'Bancolombia'
      }
    };

    await supabase
      .from('datos_maestros')
      .insert({
        tipo: 'AUDITORIA_ACCION',
        orden: reciboNum,
        valor: JSON.stringify(auditRecord)
      });

    // 3. Actualizar la cuota
    const obsCuota = excluidoCierre
      ? `Recibo #${reciboNum} (Excluido de Cierre - Dejado en corte previo) - Transferencia Bancolombia`
      : `Recibo #${reciboNum} - Transferencia Bancolombia`;

    await supabase
      .from('cuotas')
      .update({
        valor_pagado: monto,
        estado_cuota: 'PAGA',
        fecha_pago: fechaPago,
        medio_pago: 'TRANSFERENCIA',
        observacion: obsCuota,
        comprobante_url: JSON.stringify([reciboPayload])
      })
      .eq('id', cuotaId);

    console.log(`Recibo #${reciboNum} [${fechaPago}]: ${lote.id_lote} | Cuota #${cuotaNum} | $${monto.toLocaleString('es-CO')} -> ${finalClienteNombre}`);
  }

  // 4. Asegurar saldos exactos de ventas para LC1 - 15 - 8 y LC2 - 42 - 5
  await supabase
    .from('ventas')
    .update({ saldo: 5250000.0, abonos: 3875000.0 })
    .eq('id', 'ea6a6ad3-85fe-44fc-900c-f0d1ae92e0cb'); // LC1 - 15 - 8

  await supabase
    .from('ventas')
    .update({ saldo: 20000000.0, abonos: 4000000.0 })
    .eq('id', 'd02fd88d-4f7f-4751-8292-d27d26f37e5b'); // LC2 - 42 - 5

  console.log('\n========================================================================');
  console.log('✅ REORDENAMIENTO COMPLETADO CON ÉXITO');
  console.log('========================================================================');
}

main().catch(console.error);
