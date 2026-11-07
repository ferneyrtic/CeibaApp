const { createClient } = require('./ceiba-app/node_modules/@supabase/supabase-js');
const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VENTA_ID = '958a6457-47cc-4596-8847-2315da9185fc'; // LC1 - 9 - 6 (Angie Catherine Forero Calderon)

async function run() {
  console.log('=== 1. OBTENER CUOTAS 9, 10, 11 DE LC1 - 9 - 6 ===');
  const { data: cuotas, error: errC } = await supabase.from('cuotas')
    .select('*')
    .eq('venta_id', VENTA_ID)
    .in('numero_cuota', [9, 10, 11])
    .order('numero_cuota', { ascending: true });

  if (errC) {
    console.error('Error obteniendo cuotas:', errC);
    return;
  }

  const c9 = cuotas.find(c => c.numero_cuota === 9);
  const c10 = cuotas.find(c => c.numero_cuota === 10);
  const c11 = cuotas.find(c => c.numero_cuota === 11);

  console.log('Antes:');
  console.log('C9 :', c9?.fecha_pago, c9?.valor_pagado, c9?.observacion);
  console.log('C10:', c10?.fecha_pago, c10?.valor_pagado, c10?.observacion);
  console.log('C11:', c11?.fecha_pago, c11?.valor_pagado, c11?.observacion);

  console.log('\n=== 2. ACTUALIZAR CUOTAS 9 Y 10 EN SUPABASE ===');
  // Cuota 9: pago del 27 de octubre ($500.000, Recibo #3459)
  const { error: err9 } = await supabase.from('cuotas').update({
    fecha_pago: '2026-10-27',
    valor_pagado: 500000,
    valor_cuota: 500000,
    estado_cuota: 'PAGA',
    medio_pago: 'TRANSFERENCIA',
    observacion: 'Recibo #3459 ($500.000) el 2026-10-27'
  }).eq('id', c9.id);
  if (err9) console.error('Error actualizando C9:', err9);
  else console.log('✓ Cuota 9 actualizada: Fecha Pago = 2026-10-27 ($500.000 - Recibo #3459)');

  // Cuota 10: pago del 28 de octubre ($1.000.000, Recibo #3496)
  const { error: err10 } = await supabase.from('cuotas').update({
    fecha_pago: '2026-10-28',
    valor_pagado: 1000000,
    valor_cuota: 1000000,
    estado_cuota: 'PAGA',
    medio_pago: 'TRANSFERENCIA',
    observacion: 'Recibo #3496 ($1.000.000) el 2026-10-28'
  }).eq('id', c10.id);
  if (err10) console.error('Error actualizando C10:', err10);
  else console.log('✓ Cuota 10 actualizada: Fecha Pago = 2026-10-28 ($1.000.000 - Recibo #3496)');

  // Asegurar Cuota 11 con valor_cuota 1000000
  const { error: err11 } = await supabase.from('cuotas').update({
    valor_cuota: 1000000,
    estado_cuota: 'PAGA'
  }).eq('id', c11.id);
  if (err11) console.error('Error actualizando C11:', err11);
  else console.log('✓ Cuota 11 confirmada: Fecha Pago = 2026-11-05 ($1.000.000 - Recibo #3588)');

  console.log('\n=== 3. ACTUALIZAR DATOS_MAESTROS RECIBOS 3459 Y 3496 ===');
  // Recibo 3459 -> asignado a Cuota 9 de LC1 - 9 - 6
  const { data: dm3459 } = await supabase.from('datos_maestros').select('*').eq('orden', 3459);
  for (const row of dm3459 || []) {
    if (row.tipo === 'RECIBO_CAJA') {
      let val = JSON.parse(row.valor);
      val.lote_id_str = 'LC1 - 9 - 6';
      val.venta_id = VENTA_ID;
      val.numero_cuota = 9;
      val.concepto = 'Pago Cuota 9';
      val.observaciones = 'Transferencia a cuenta Bancolombia · Ref: M03478680 · Cuota 9 ($500.000)';
      val.es_pago_completo = true;
      val.saldo_restante_cuota = 0;
      await supabase.from('datos_maestros').update({ valor: JSON.stringify(val) }).eq('id', row.id);
      console.log('✓ Recibo #3459 en datos_maestros reasignado a Cuota 9 de LC1 - 9 - 6');
    }
  }

  // Recibo 3496 -> asignado a Cuota 10 de LC1 - 9 - 6
  const { data: dm3496 } = await supabase.from('datos_maestros').select('*').eq('orden', 3496);
  for (const row of dm3496 || []) {
    if (row.tipo === 'RECIBO_CAJA') {
      let val = JSON.parse(row.valor);
      val.lote_id_str = 'LC1 - 9 - 6';
      val.venta_id = VENTA_ID;
      val.numero_cuota = 10;
      val.concepto = 'Pago Cuota 10';
      val.observaciones = 'Transferencia a cuenta Davivienda · Ref: 115827 · Cuota 10 ($1.000.000)';
      val.es_pago_completo = true;
      val.saldo_restante_cuota = 0;
      await supabase.from('datos_maestros').update({ valor: JSON.stringify(val) }).eq('id', row.id);
      console.log('✓ Recibo #3496 en datos_maestros reasignado a Cuota 10 de LC1 - 9 - 6');
    }
  }

  console.log('\n=== VERIFICACIÓN FINAL EN SUPABASE ===');
  const { data: updatedCuotas } = await supabase.from('cuotas')
    .select('numero_cuota, fecha_vencimiento, fecha_pago, valor_cuota, valor_pagado, estado_cuota, observacion')
    .eq('venta_id', VENTA_ID)
    .order('numero_cuota', { ascending: true });

  updatedCuotas.slice(6, 13).forEach(c => {
    console.log(`CUOTA ${c.numero_cuota} | Venc: ${c.fecha_vencimiento} | Pago: ${c.fecha_pago} | Estado: ${c.estado_cuota} | Pagado: $${c.valor_pagado} | Obs: ${c.observacion}`);
  });
}

run();
