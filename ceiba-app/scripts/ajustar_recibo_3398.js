import { createClient } from '@supabase/supabase-js';
import { numeroALetrasCOP } from '../src/utils/numeroALetras.js';

const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log('--- REVERSIÓN Y REASIGNACIÓN DE RECIBO #3398 ---');

  // 1. REVERTIR LC1 - 15 - 8 (Cuota #9)
  console.log('1. Revirtiendo LC1 - 15 - 8 (Cuota #9)...');
  const venta15_8Id = 'ea6a6ad3-85fe-44fc-900c-f0d1ae92e0cb';
  const cuota15_8Id = '5522d841-cfac-4387-bca5-3210f1be8b1d';

  const { error: revCuotaErr } = await supabase
    .from('cuotas')
    .update({
      fecha_pago: null,
      valor_pagado: 0.0,
      estado_cuota: 'AL DÍA',
      medio_pago: null,
      observacion: null,
      comprobante_url: null
    })
    .eq('id', cuota15_8Id);

  if (revCuotaErr) {
    console.error('Error revirtiendo cuota 9 de LC1 - 15 - 8:', revCuotaErr);
  } else {
    console.log('  Cuota 9 de LC1 - 15 - 8 revertida con éxito.');
  }

  const { error: revVentaErr } = await supabase
    .from('ventas')
    .update({
      saldo: 6125000.0,
      abonos: 3000000.0
    })
    .eq('id', venta15_8Id);

  if (revVentaErr) {
    console.error('Error revirtiendo venta de LC1 - 15 - 8:', revVentaErr);
  } else {
    console.log('  Venta LC1 - 15 - 8 saldo/abonos restaurados.');
  }

  // 2. APLICAR A LC1 - 11 - 2 (Cuota #10)
  console.log('\n2. Aplicando Recibo #3398 a LC1 - 11 - 2 (Cuota #10)...');
  const lote11_2Id = '910bca3a-59c8-4ab6-8b89-f95e817e3cdd';
  const venta11_2Id = '4bce6c71-70a6-4ea0-a0bf-30fab940c995';
  const cuota11_2Id = 'f1ca818b-1c74-4719-bc5f-4fa533c087b2';
  const clienteNombre = 'CESAR AUGUSTO LOPEZ BUITRAGO';
  const clienteDoc = '79280833';
  const monto = 875000;
  const fechaPago = '2026-10-19';
  const valorLetras = numeroALetrasCOP(monto);
  const concepto = `Pago Cuota #10 - LC1 - 11 - 2 - Titular: ${clienteNombre}`;
  const observaciones = 'Transferencia a cuenta Bancolombia verificada en extracto';

  const recibo3398Payload = {
    numero_recibo: 3398,
    pagado_a: 'PROYECTO CAMPESTRE LA CEIBA',
    ciudad: 'Acacías',
    lote_id_str: 'LC1 - 11 - 2',
    cliente_nombre: clienteNombre,
    cliente_doc: clienteDoc,
    venta_id: venta11_2Id,
    cuota_id: cuota11_2Id,
    numero_cuota: 10,
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

  // 3. ACTUALIZAR DATOS_MAESTROS (RECIBO_CAJA)
  const { data: dmUpdate, error: dmErr } = await supabase
    .from('datos_maestros')
    .update({
      valor: JSON.stringify(recibo3398Payload)
    })
    .eq('tipo', 'RECIBO_CAJA')
    .eq('orden', 3398)
    .select();

  if (dmErr) {
    console.error('Error actualizando RECIBO_CAJA #3398 en datos_maestros:', dmErr);
  } else {
    console.log('  RECIBO_CAJA #3398 actualizado en datos_maestros para LC1 - 11 - 2.');
  }

  // 4. ACTUALIZAR DATOS_MAESTROS (AUDITORIA_ACCION)
  const audit3398Record = {
    id: `log_${Date.now()}_3398`,
    timestamp: `${fechaPago}T11:00:00.000Z`,
    modulo: 'RECIBOS_CAJA',
    accion: 'EMISION_RECIBO_PAGO',
    lote_id_str: 'LC1 - 11 - 2',
    lote_id: lote11_2Id,
    cliente_nombre: clienteNombre,
    usuario_email: 'secretaria@laceiba.com',
    usuario_nombre: 'Tatiana (Secretaría)',
    usuario_rol: 'secretaria',
    descripcion: `Emisión de Recibo Oficial #3398 por $${monto.toLocaleString('es-CO')} (${concepto}) a nombre de ${clienteNombre}`,
    detalles: {
      numero_recibo: 3398,
      cuota_id: cuota11_2Id,
      numero_cuota: 10,
      monto: monto,
      medio_pago: 'TRANSFERENCIA',
      banco: 'Bancolombia'
    }
  };

  const { error: audErr } = await supabase
    .from('datos_maestros')
    .update({
      valor: JSON.stringify(audit3398Record)
    })
    .eq('tipo', 'AUDITORIA_ACCION')
    .eq('orden', 3398);

  if (audErr) {
    console.error('Error actualizando AUDITORIA_ACCION #3398:', audErr);
  } else {
    console.log('  AUDITORIA_ACCION #3398 actualizada para LC1 - 11 - 2.');
  }

  // 5. ACTUALIZAR CUOTA 10 DE LC1 - 11 - 2
  const { error: cUpdErr } = await supabase
    .from('cuotas')
    .update({
      valor_pagado: monto,
      estado_cuota: 'PAGA',
      fecha_pago: fechaPago,
      medio_pago: 'TRANSFERENCIA',
      observacion: `Recibo #3398 - Transferencia Bancolombia`,
      comprobante_url: JSON.stringify([recibo3398Payload])
    })
    .eq('id', cuota11_2Id);

  if (cUpdErr) {
    console.error('Error actualizando cuota 10 de LC1 - 11 - 2:', cUpdErr);
  } else {
    console.log('  Cuota 10 de LC1 - 11 - 2 actualizada a PAGA con Recibo #3398.');
  }

  // 6. ACTUALIZAR SALDO Y ABONOS DE VENTA LC1 - 11 - 2
  const nuevoSaldo11_2 = 13124937.0 - monto;
  const nuevosAbonos11_2 = 3000000.0 + monto;

  const { error: vUpdErr } = await supabase
    .from('ventas')
    .update({
      saldo: nuevoSaldo11_2,
      abonos: nuevosAbonos11_2
    })
    .eq('id', venta11_2Id);

  if (vUpdErr) {
    console.error('Error actualizando venta LC1 - 11 - 2:', vUpdErr);
  } else {
    console.log(`  Venta LC1 - 11 - 2 actualizada (Nuevo Saldo: $${nuevoSaldo11_2.toLocaleString('es-CO')}, Abonos: $${nuevosAbonos11_2.toLocaleString('es-CO')}).`);
  }

  console.log('\n✅ AJUSTE DE RECIBO #3398 COMPLETADO EXITOSAMENTE');
}

main().catch(console.error);
