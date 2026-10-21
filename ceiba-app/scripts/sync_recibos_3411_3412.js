import { createClient } from '@supabase/supabase-js';
import { numeroALetrasCOP } from '../src/utils/numeroALetras.js';

const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const NUEVOS_RECIBOS = [
  {
    reciboNum: 3411,
    loteIdStr: 'LC1 - 15 - 8',
    cuotaNum: 9,
    monto: 875000,
    fechaPago: '2026-10-19',
    clienteNombre: 'MARIA YOLANDA CARACAS LEON/JORGE EDGAR GOMEZ',
    clienteDoc: '51648764',
    celular: '321 461 2934'
  },
  {
    reciboNum: 3412,
    loteIdStr: 'LC2 - 42 - 5',
    cuotaNum: 4,
    monto: 1000000,
    fechaPago: '2026-10-21',
    clienteNombre: 'JOSE ISBELIO RAMIREZ CORTES',
    clienteDoc: '17386102',
    celular: '314 3070913'
  }
];

async function main() {
  console.log('========================================================================');
  console.log('SINCRONIZACIÓN Y CARGUE OFICIAL: RECIBOS #3411 Y #3412 (TATIANA)');
  console.log('========================================================================\n');

  // Paso 0: Ajustar Cuota #3 de LC2 - 42 - 5 (Pago histórico anterior del 21-Septiembre)
  console.log('0. Verificando y normalizando Cuota #3 de LC2 - 42 - 5 (Septiembre)...');
  const venta42_5Id = 'd02fd88d-4f7f-4751-8292-d27d26f37e5b';
  const { data: cuota3_42_5 } = await supabase
    .from('cuotas')
    .select('id, numero_cuota, fecha_pago, valor_pagado, estado_cuota')
    .eq('venta_id', venta42_5Id)
    .eq('numero_cuota', 3)
    .single();

  if (cuota3_42_5) {
    const { error: updC3Err } = await supabase
      .from('cuotas')
      .update({
        fecha_pago: '2026-09-21',
        valor_pagado: 1000000.0,
        estado_cuota: 'PAGA',
        medio_pago: 'TRANSFERENCIA',
        observacion: 'Pago registrado en extracto / Excel anterior'
      })
      .eq('id', cuota3_42_5.id);
    if (updC3Err) {
      console.warn('Aviso actualizando Cuota #3 de LC2 - 42 - 5:', updC3Err);
    } else {
      console.log('  ✅ Cuota #3 de LC2 - 42 - 5 normalizada: PAGA el 2026-09-21 ($1.000.000).');
    }
  }

  // Procesar cada uno de los nuevos recibos
  for (const item of NUEVOS_RECIBOS) {
    const { reciboNum, loteIdStr, cuotaNum, monto, fechaPago, clienteNombre, clienteDoc } = item;
    console.log(`\n------------------------------------------------------------`);
    console.log(`Procesando Recibo #${reciboNum} -> Lote ${loteIdStr}, Cuota #${cuotaNum}, $${monto.toLocaleString('es-CO')} (${fechaPago})`);
    console.log(`------------------------------------------------------------`);

    // 1. Buscar lote
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
      console.error(`❌ Error: No se encontró el lote ${loteIdStr}`);
      continue;
    }

    const lote = lotes[0];
    const loteId = lote.id;

    // 2. Buscar venta
    const { data: ventas, error: vErr } = await supabase
      .from('ventas')
      .select('id, saldo, abonos, precio_venta, valor_cuota_inicial, clientes(nombre, doc_cliente)')
      .eq('lote_id', loteId);

    if (vErr || !ventas || ventas.length === 0) {
      console.error(`❌ Error: Venta no encontrada para lote ${loteIdStr}`);
      continue;
    }

    const venta = ventas[0];
    const ventaId = venta.id;
    const finalClienteNombre = clienteNombre || venta.clientes?.nombre || 'Titular';
    const finalClienteDoc = clienteDoc || venta.clientes?.doc_cliente || '';

    // 3. Buscar cuota
    const { data: cuotas, error: cErr } = await supabase
      .from('cuotas')
      .select('*')
      .eq('venta_id', ventaId)
      .eq('numero_cuota', cuotaNum);

    if (cErr || !cuotas || cuotas.length === 0) {
      console.error(`❌ Error: Cuota #${cuotaNum} no encontrada para venta ${ventaId}`);
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

    // 4. Guardar o actualizar en datos_maestros tipo RECIBO_CAJA
    const { data: existingRecibo } = await supabase
      .from('datos_maestros')
      .select('id')
      .eq('tipo', 'RECIBO_CAJA')
      .eq('orden', reciboNum);

    if (existingRecibo && existingRecibo.length > 0) {
      await supabase
        .from('datos_maestros')
        .update({ valor: JSON.stringify(reciboPayload) })
        .eq('id', existingRecibo[0].id);
      reciboPayload.db_id = existingRecibo[0].id;
      console.log(`  ✅ RECIBO_CAJA #${reciboNum} actualizado en datos_maestros.`);
    } else {
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
        console.error(`  ❌ Error insertando RECIBO_CAJA #${reciboNum}:`, dmErr);
      } else {
        reciboPayload.db_id = dmRecibo.id;
        console.log(`  ✅ RECIBO_CAJA #${reciboNum} insertado exitosamente en datos_maestros.`);
      }
    }

    // 5. Guardar o actualizar en datos_maestros tipo AUDITORIA_ACCION
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

    const { data: existingAudit } = await supabase
      .from('datos_maestros')
      .select('id')
      .eq('tipo', 'AUDITORIA_ACCION')
      .eq('orden', reciboNum);

    if (existingAudit && existingAudit.length > 0) {
      await supabase
        .from('datos_maestros')
        .update({ valor: JSON.stringify(auditRecord) })
        .eq('id', existingAudit[0].id);
      console.log(`  ✅ AUDITORIA_ACCION #${reciboNum} actualizada a nombre de Tatiana (Secretaría).`);
    } else {
      const { error: audErr } = await supabase
        .from('datos_maestros')
        .insert({
          tipo: 'AUDITORIA_ACCION',
          orden: reciboNum,
          valor: JSON.stringify(auditRecord)
        });
      if (audErr) {
        console.warn(`  Aviso guardando AUDITORIA_ACCION #${reciboNum}:`, audErr);
      } else {
        console.log(`  ✅ AUDITORIA_ACCION #${reciboNum} registrada a nombre de Tatiana (Secretaría).`);
      }
    }

    // 6. Actualizar la cuota
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
      console.error(`  ❌ Error actualizando cuota #${cuotaNum}:`, cUpdErr);
    } else {
      console.log(`  ✅ Cuota #${cuotaNum} de ${lote.id_lote} actualizada: PAGA ($${monto.toLocaleString('es-CO')}).`);
    }

    // 7. Actualizar saldo y abonos de la venta
    let nuevoSaldo;
    let nuevosAbonos;

    if (loteIdStr.includes('LC1 - 15 - 8')) {
      nuevoSaldo = 5250000.0;
      nuevosAbonos = 3875000.0;
    } else if (loteIdStr.includes('LC2 - 42 - 5')) {
      nuevoSaldo = 20000000.0;
      nuevosAbonos = 4000000.0;
    } else {
      nuevoSaldo = Math.max(0, (Number(venta.saldo) || 0) - monto);
      nuevosAbonos = (Number(venta.abonos) || 0) + monto;
    }

    const { error: vUpdErr } = await supabase
      .from('ventas')
      .update({
        saldo: nuevoSaldo,
        abonos: nuevosAbonos
      })
      .eq('id', ventaId);

    if (vUpdErr) {
      console.warn(`  Aviso actualizando saldo de venta:`, vUpdErr);
    } else {
      console.log(`  ✅ Venta actualizada: Saldo = $${nuevoSaldo.toLocaleString('es-CO')}, Abonos = $${nuevosAbonos.toLocaleString('es-CO')}.`);
    }
  }

  console.log('\n========================================================================');
  console.log('✅ PROCESO DE CARGUE Y REGISTRO FINALIZADO CON ÉXITO');
  console.log('========================================================================');
}

main().catch(console.error);
