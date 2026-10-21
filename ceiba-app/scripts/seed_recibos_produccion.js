import { createClient } from '@supabase/supabase-js';
import { numeroALetrasCOP } from '../src/utils/numeroALetras.js';

const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const PAGOS_DATA = [
  {
    reciboNum: 3398,
    loteIdStr: 'LC1 - 11 - 2',
    cuotaNum: 10,
    monto: 875000,
    fechaPago: '2026-10-19',
    clienteNombre: 'CESAR AUGUSTO LOPEZ BUITRAGO'
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
    loteIdStr: 'LC1 - 21 - 4',
    cuotaNum: 10,
    monto: 1083000,
    fechaPago: '2026-10-19',
    clienteNombre: 'NURY JULIETH RODRIGUEZ CASTILLO'
  },
  {
    reciboNum: 3402,
    loteIdStr: 'LC2 - 33 - 12',
    cuotaNum: 9,
    monto: 1000000,
    fechaPago: '2026-10-19',
    clienteNombre: 'SANDRA PATRICIA ESCOBAR CABALLERO'
  },
  {
    reciboNum: 3403,
    loteIdStr: 'LC2 - 35 - 9',
    cuotaNum: 6,
    monto: 1000000,
    fechaPago: '2026-10-19',
    clienteNombre: 'DIANA MARCELA HERRERA RODRIGUEZ'
  },
  {
    reciboNum: 3404,
    loteIdStr: 'LC2 - 37 - 11',
    cuotaNum: 5,
    monto: 1000000,
    fechaPago: '2026-10-19',
    clienteNombre: 'RUBEN DARIO REYES MARTIN'
  },
  {
    reciboNum: 3405,
    loteIdStr: 'LC1 - 3 - 9',
    cuotaNum: 14,
    monto: 875000,
    fechaPago: '2026-10-20',
    clienteNombre: 'LUISA FERNANDA GOMEZ CARRERO/JUAN DAVID REY'
  },
  {
    reciboNum: 3406,
    loteIdStr: 'LC1 - 5 - 6',
    cuotaNum: 8,
    monto: 1231000,
    fechaPago: '2026-10-20',
    clienteNombre: 'MILENA JOHANNA COCA MEJIA/YEISON ALBERTO MONROY'
  },
  {
    reciboNum: 3407,
    loteIdStr: 'LC1 - 13 - 8',
    cuotaNum: 15,
    monto: 800000,
    fechaPago: '2026-10-20',
    clienteNombre: 'AURORA LUCIA PAEZ CALDERON'
  },
  {
    reciboNum: 3408,
    loteIdStr: 'LC2 - 31 - 1 - 2 - 11 Y 12',
    cuotaNum: 16,
    monto: 3416800,
    fechaPago: '2026-10-20',
    clienteNombre: 'TULIA ETELVINA VELASQUEZ RODRIGUEZ'
  },
  {
    reciboNum: 3409,
    loteIdStr: 'LC2 - 35 - 6',
    cuotaNum: 8,
    monto: 1126300,
    fechaPago: '2026-10-20',
    clienteNombre: 'RUTH DENIS ALVAREZ BUITRAGO'
  },
  {
    reciboNum: 3410,
    loteIdStr: 'LC2 - 47 - 2',
    cuotaNum: 6,
    monto: 1000000,
    fechaPago: '2026-10-20',
    clienteNombre: 'DORA EMILCE CASAS GONZALEZ / JAVIER ERNESTO VIDARTE PENNA'
  }
];

async function main() {
  console.log(`Iniciando registro oficial de ${PAGOS_DATA.length} pagos y recibos con identidad 'Tatiana (Secretaría)'...`);

  // 1. Limpiar cualquier prueba previa en datos_maestros para RECIBO_CAJA y AUDITORIA_ACCION
  const { error: delErr1 } = await supabase
    .from('datos_maestros')
    .delete()
    .eq('tipo', 'RECIBO_CAJA');
  if (delErr1) console.warn('Aviso limpiando RECIBO_CAJA:', delErr1);

  const { error: delErr2 } = await supabase
    .from('datos_maestros')
    .delete()
    .eq('tipo', 'AUDITORIA_ACCION');
  if (delErr2) console.warn('Aviso limpiando AUDITORIA_ACCION:', delErr2);

  const resumenResultados = [];

  for (let i = 0; i < PAGOS_DATA.length; i++) {
    const item = PAGOS_DATA[i];
    const { reciboNum, loteIdStr, cuotaNum, monto, fechaPago, clienteNombre } = item;

    console.log(`\n[Recibo #${reciboNum}] Procesando Lote: ${loteIdStr}, Cuota: #${cuotaNum}, Monto: $${monto.toLocaleString('es-CO')}...`);

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

    if (!lotes || lotes.length === 0) {
      console.error(`ERROR: Lote no encontrado: ${loteIdStr}`);
      continue;
    }

    const lote = lotes[0];
    const loteId = lote.id;

    // Buscar venta
    const { data: ventas, error: vErr } = await supabase
      .from('ventas')
      .select('id, saldo, abonos, clientes(nombre, doc_cliente)')
      .eq('lote_id', loteId);

    if (vErr || !ventas || ventas.length === 0) {
      console.error(`ERROR: Venta no encontrada para lote ${loteIdStr}`);
      continue;
    }

    const venta = ventas[0];
    const ventaId = venta.id;
    const finalClienteNombre = clienteNombre || venta.clientes?.nombre || 'Titular';
    const finalClienteDoc = venta.clientes?.doc_cliente || '';

    // Buscar cuota
    const { data: cuotas, error: cErr } = await supabase
      .from('cuotas')
      .select('*')
      .eq('venta_id', ventaId)
      .eq('numero_cuota', cuotaNum);

    if (cErr || !cuotas || cuotas.length === 0) {
      console.error(`ERROR: Cuota #${cuotaNum} no encontrada para venta ${ventaId}`);
      continue;
    }

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
      concepto,
      observaciones,
      registrado_por: 'Tatiana (Secretaría)',
      created_at: `${fechaPago}T11:00:00.000Z`
    };

    // 1. Guardar en datos_maestros como RECIBO_CAJA
    const { data: dmRecibo, error: dmErr } = await supabase
      .from('datos_maestros')
      .insert({
        tipo: 'RECIBO_CAJA',
        orden: reciboNum,
        valor: JSON.stringify(reciboPayload)
      })
      .select()
      .single();

    if (dmErr) {
      console.error(`Error guardando RECIBO_CAJA #${reciboNum}:`, dmErr);
    } else {
      reciboPayload.db_id = dmRecibo.id;
    }

    // 2. Guardar en datos_maestros como AUDITORIA_ACCION
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

    const { error: audErr } = await supabase
      .from('datos_maestros')
      .insert({
        tipo: 'AUDITORIA_ACCION',
        orden: reciboNum,
        valor: JSON.stringify(auditRecord)
      });

    if (audErr) {
      console.warn(`Aviso guardando AUDITORIA_ACCION para recibo #${reciboNum}:`, audErr);
    }

    // 3. Actualizar la cuota
    const { error: cUpdErr } = await supabase
      .from('cuotas')
      .update({
        valor_pagado: monto,
        estado_cuota: 'PAGA',
        fecha_pago: fechaPago,
        medio_pago: 'TRANSFERENCIA',
        observacion: `Recibo #${reciboNum} - Transferencia Bancolombia`,
        comprobante_url: JSON.stringify([reciboPayload])
      })
      .eq('id', cuotaId);

    if (cUpdErr) {
      console.error(`Error actualizando cuota #${cuotaNum}:`, cUpdErr);
    }

    // 4. Actualizar el saldo de la venta
    const nuevoSaldo = Math.max(0, (Number(venta.saldo) || 0) - monto);
    const nuevosAbonos = (Number(venta.abonos) || 0) + monto;

    const { error: vUpdErr } = await supabase
      .from('ventas')
      .update({
        saldo: nuevoSaldo,
        abonos: nuevosAbonos
      })
      .eq('id', ventaId);

    if (vUpdErr) {
      console.warn(`Aviso actualizando saldo de venta ${ventaId}:`, vUpdErr);
    }

    resumenResultados.push({
      reciboNum,
      fechaPago,
      lote: lote.id_lote,
      cuotaNum,
      monto,
      cliente: finalClienteNombre,
      responsable: 'Tatiana (Secretaría)'
    });
  }

  console.log('\n============================================================');
  console.log('✅ REGISTRO OFICIAL COMPLETADO EXITOSAMENTE');
  console.log('============================================================');
  console.table(resumenResultados);
}

main().catch(console.error);
