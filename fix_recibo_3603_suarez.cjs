const { createClient } = require('./ceiba-app/node_modules/@supabase/supabase-js');
const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CLIENTE_ID = '4f6a4c67-213f-4d21-85ee-d99489a51bda';
const LOTE_ID = '647bd7b8-0138-49a9-8407-6a48a5b56896';

async function run() {
  console.log('=== 1. ACTUALIZAR CLIENTE EN SUPABASE ===');
  const { error: errCl } = await supabase.from('clientes').update({
    nombre: 'JAIME SUAREZ'
  }).eq('id', CLIENTE_ID);
  if (errCl) console.error('Error actualizando cliente:', errCl);
  else console.log('✓ Cliente actualizado: JAIME SUAREZ (id:', CLIENTE_ID, ')');

  console.log('\n=== 2. ACTUALIZAR LOTE LC2 - 24 - 6 EN SUPABASE ===');
  const { error: errLote } = await supabase.from('lotes').update({
    propietario: 'JAIME SUAREZ',
    observacion: 'Arras de apartado por $500.000 con Recibo #3603 (Ref: 282447) el 06/11/2026. Válidas hasta 20/11/2026 (No devolutivas). A nombre de Jaime Suarez.'
  }).eq('id', LOTE_ID);
  if (errLote) console.error('Error actualizando lote:', errLote);
  else console.log('✓ Lote LC2 - 24 - 6 actualizado con propietario JAIME SUAREZ.');

  console.log('\n=== 3. ACTUALIZAR RECIBO #3603 EN DATOS_MAESTROS ===');
  const { data: dmRows, error: errDmGet } = await supabase.from('datos_maestros').select('*').eq('orden', 3603);
  if (errDmGet) {
    console.error('Error obteniendo datos_maestros 3603:', errDmGet);
    return;
  }

  for (const row of dmRows) {
    let valObj = {};
    try {
      valObj = typeof row.valor === 'string' ? JSON.parse(row.valor) : row.valor;
    } catch (e) {
      valObj = row.valor;
    }

    if (row.tipo === 'RECIBO_CAJA') {
      valObj.cliente_nombre = 'JAIME SUAREZ';
      valObj.motivo = 'Apartado temporal de lote (arras) para Lote 6 - Mz 24 - 2 etapa a nombre de Jaime Suarez';
      valObj.concepto = 'ARRAS - Lote 6 - Mz 24 - 2 etapa a nombre de Jaime Suarez';
      valObj.observaciones = 'Transferencia · Ref: 282447 · Arras válidas hasta el 20/11/2026 · Arras no devolutivas · Lote 6 - Mz 24 - 2 etapa a nombre de Jaime Suarez';

      const { error: errUp } = await supabase.from('datos_maestros').update({
        valor: JSON.stringify(valObj)
      }).eq('id', row.id);
      if (errUp) console.error('Error actualizando RECIBO_CAJA 3603:', errUp);
      else console.log('✓ RECIBO_CAJA 3603 actualizado a nombre de JAIME SUAREZ.');
    } else if (row.tipo === 'AUDITORIA_ACCION') {
      valObj.cliente_nombre = 'JAIME SUAREZ';
      valObj.descripcion = 'Recibo Oficial #3603 registrado como ARRAS de $500.000 (Transferencia Ref: 282447) para MANZANA 24 LOTE 6 (LC2 - 24 - 6) a nombre de Jaime Suarez. Válidas hasta 20/11/2026. Consecutivo siguiente disponible: #3604.';

      const { error: errUp } = await supabase.from('datos_maestros').update({
        valor: JSON.stringify(valObj)
      }).eq('id', row.id);
      if (errUp) console.error('Error actualizando AUDITORIA_ACCION 3603:', errUp);
      else console.log('✓ AUDITORIA_ACCION 3603 actualizada a nombre de JAIME SUAREZ.');
    }
  }

  console.log('\n=== VERIFICACIÓN EN SUPABASE ===');
  const { data: verifyDm } = await supabase.from('datos_maestros').select('*').eq('orden', 3603);
  verifyDm.forEach(r => console.log(r.tipo, '=>', r.valor));

  const { data: verifyCl } = await supabase.from('clientes').select('*').eq('id', CLIENTE_ID);
  console.log('Cliente verificado:', verifyCl);

  const { data: verifyLt } = await supabase.from('lotes').select('id_lote, estado, propietario, observacion').eq('id', LOTE_ID);
  console.log('Lote verificado:', verifyLt);
}

run();
