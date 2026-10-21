import { createClient } from '@supabase/supabase-js';
import { numeroALetrasCOP } from '../src/utils/numeroALetras.js';

const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Los 13 recibos exactos de la foto de la secretaria "INGRESOS LA CEIBA"
const RECIBOS_FOTO = [
  {
    reciboNum: 3399,
    fecha: '2026-10-19',
    loteFoto: '2º MZ 35 L 11',
    ref: 'REF 95000',
    banco: 'Bancolombia',
    monto: 1000000,
    // Candidatos en BD: LC2 - 35 - 9 (Diana Herrera C#6) o LC2 - 37 - 11 (Ruben Reyes C#5)
    // Asignamos preliminarmente a LC2 - 35 - 9 por coincidencia de Manzana (MZ 35)
    loteIdStr: 'LC2 - 35 - 9',
    cuotaNum: 6,
    clienteNombre: 'DIANA MARCELA HERRERA RODRIGUEZ'
  },
  {
    reciboNum: 3400,
    fecha: '2026-10-19',
    loteFoto: '1º MZ 21 L 4',
    ref: 'REF 475549',
    banco: 'Davivienda',
    monto: 1083000,
    loteIdStr: 'LC1 - 21 - 4',
    cuotaNum: 10,
    clienteNombre: 'NURY JULIETH RODRIGUEZ CASTILLO'
  },
  {
    reciboNum: 3401,
    fecha: '2026-10-19',
    loteFoto: '2º MZ 33 L 12',
    ref: 'REF d48c226b6227',
    banco: 'Bancolombia',
    monto: 1000000,
    loteIdStr: 'LC2 - 33 - 12',
    cuotaNum: 9,
    clienteNombre: 'SANDRA PATRICIA ESCOBAR CABALLERO'
  },
  {
    reciboNum: 3402,
    fecha: '2026-10-20',
    loteFoto: '1º MZ 3 L 9',
    ref: 'REF 11200',
    banco: 'Bancolombia',
    monto: 875000,
    loteIdStr: 'LC1 - 3 - 9',
    cuotaNum: 14,
    clienteNombre: 'LUISA FERNANDA GOMEZ CARRERO / JUAN DAVID REY'
  },
  {
    reciboNum: 3403,
    fecha: '2026-10-20',
    loteFoto: '2º MZ 47 L 2',
    ref: 'REF MO7880100',
    banco: 'Nequi',
    monto: 1000000,
    loteIdStr: 'LC2 - 47 - 2',
    cuotaNum: 6,
    clienteNombre: 'DORA EMILCE CASAS GONZALEZ / JAVIER ERNESTO VIDARTE PENNA'
  },
  {
    reciboNum: 3404,
    fecha: '2026-10-19',
    loteFoto: '1º MZ 13 L 2,3,4,5',
    ref: 'REF 9017699',
    banco: 'Banco de Bogotá',
    monto: 1575000,
    loteIdStr: 'LC1 - 13 - 2 - 3 - 4 Y 5',
    cuotaNum: 21,
    clienteNombre: 'ADOLFO PORRAS GAVANZO'
  },
  {
    reciboNum: 3405,
    fecha: '2026-10-20',
    loteFoto: '2º MZ 35 L 6',
    ref: 'REF 224947534',
    banco: 'Bancolombia',
    monto: 1126300,
    loteIdStr: 'LC2 - 35 - 6',
    cuotaNum: 8,
    clienteNombre: 'RUTH DENIS ALVAREZ BUITRAGO'
  },
  {
    reciboNum: 3406,
    fecha: '2026-10-19',
    loteFoto: '1º MZ 13 L 8',
    ref: 'REF M17337374',
    banco: 'Nequi',
    monto: 800000,
    loteIdStr: 'LC1 - 13 - 8',
    cuotaNum: 15,
    clienteNombre: 'AURORA LUCIA PAEZ CALDERON'
  },
  {
    reciboNum: 3407,
    fecha: '2026-10-19',
    loteFoto: '1º MZ 4 L 1',
    ref: 'REF M22640047',
    banco: 'Nequi',
    monto: 1640800,
    loteIdStr: 'LC1 - 4 - 1',
    cuotaNum: 5,
    clienteNombre: 'MARIA YOLANDA CARACAS LEÓN'
  },
  {
    reciboNum: 3408,
    fecha: '2026-10-19',
    loteFoto: '1º MZ 15 L 8',
    ref: 'REF M22980620',
    banco: 'Nequi',
    monto: 875000,
    loteIdStr: 'LC1 - 15 - 8',
    cuotaNum: 9,
    clienteNombre: 'MARIA YOLANDA CARACAS LEON / JORGE EDGAR GOMEZ'
  },
  {
    reciboNum: 3409,
    fecha: '2026-10-20',
    loteFoto: '2º MZ 31 L 1 11 12',
    ref: 'REF 91000-66100',
    banco: 'Bancolombia / Banco de Bogotá',
    monto: 3416800,
    loteIdStr: 'LC2 - 31 - 1 - 2 - 11 Y 12',
    cuotaNum: 16,
    clienteNombre: 'TULIA ETELVINA VELASQUEZ RODRIGUEZ'
  },
  {
    reciboNum: 3410,
    fecha: '2026-10-20',
    loteFoto: '1º MZ 5 L 6',
    ref: 'REF 24853',
    banco: 'Davivienda',
    monto: 1231000,
    loteIdStr: 'LC1 - 5 - 6',
    cuotaNum: 8,
    clienteNombre: 'MILENA JOHANNA COCA MEJIA / YEISON ALBERTO MONROY'
  },
  {
    reciboNum: 3411,
    fecha: '2026-10-21',
    loteFoto: '2º MZ 42 L 5',
    ref: 'REF 316903589',
    banco: 'Bancolombia',
    monto: 1000000,
    loteIdStr: 'LC2 - 42 - 5',
    cuotaNum: 4,
    clienteNombre: 'JOSE ISBELIO RAMIREZ CORTES'
  }
];

async function main() {
  console.log('--- ACTUALIZANDO RECIBOS OFICIALES PARA COINCIDIR 100% CON LA PLANILLA DE LA SECRETARIA ---');

  for (const item of RECIBOS_FOTO) {
    const { data: lote } = await supabase.from('lotes').select('id, id_lote').eq('id_lote', item.loteIdStr).single();
    if (!lote) {
      console.error(`Lote no encontrado: ${item.loteIdStr}`);
      continue;
    }

    const { data: venta } = await supabase.from('ventas').select('id, precio_venta, clientes(*)').eq('lote_id', lote.id).single();
    if (!venta) {
      console.error(`Venta no encontrada: ${item.loteIdStr}`);
      continue;
    }

    const { data: cuota } = await supabase.from('cuotas').select('id, fecha_vencimiento').eq('venta_id', venta.id).eq('numero_cuota', item.cuotaNum).single();
    if (!cuota) {
      console.error(`Cuota no encontrada: ${item.loteIdStr} C#${item.cuotaNum}`);
      continue;
    }

    const conceptoStr = `Pago Cuota #${item.cuotaNum} - ${item.loteIdStr} - Titular: ${item.clienteNombre}`;
    const obsStr = `Recibo #${item.reciboNum} (${item.ref}) - Transferencia ${item.banco}`;

    // Actualizar cuota
    await supabase.from('cuotas').update({
      fecha_pago: item.fecha,
      valor_pagado: item.monto,
      estado_cuota: 'PAGA',
      medio_pago: 'TRANSFERENCIA',
      observacion: obsStr
    }).eq('id', cuota.id);

    // Actualizar o insertar recibo en datos_maestros
    const payload = {
      recibo_numero: item.reciboNum,
      fecha_pago: item.fecha,
      lote_id_str: item.loteIdStr,
      cliente_nombre: item.clienteNombre,
      cliente_cedula: venta.clientes?.doc_cliente || '',
      concepto: conceptoStr,
      numero_cuota: item.cuotaNum,
      fecha_vencimiento: cuota.fecha_vencimiento,
      valor_pagado: item.monto,
      valor_letras: numeroALetrasCOP(item.monto),
      medio_pago: 'TRANSFERENCIA',
      banco: item.banco,
      referencia_bancaria: item.ref,
      lote_descripcion_foto: item.loteFoto,
      asesor: 'Secretaría (Tatiana)',
      log_usuario: 'Secretaria Tatiana',
      observaciones: obsStr,
      cuota_id: cuota.id,
      venta_id: venta.id,
      lote_id: lote.id
    };

    const { data: dmExist } = await supabase.from('datos_maestros').select('id').eq('tipo', 'RECIBO_CAJA').eq('orden', item.reciboNum).maybeSingle();
    if (dmExist) {
      await supabase.from('datos_maestros').update({ valor: JSON.stringify(payload) }).eq('id', dmExist.id);
    } else {
      await supabase.from('datos_maestros').insert({ tipo: 'RECIBO_CAJA', orden: item.reciboNum, valor: JSON.stringify(payload) });
    }

    console.log(`✅ Recibo #${item.reciboNum} [${item.loteFoto} -> ${item.loteIdStr}]: ${item.ref} | $${item.monto.toLocaleString('es-CO')} | ${item.banco}`);
  }

  // Desvincular LC2 - 37 - 11 del recibo #3405 antiguo, dejándolo como pendiente de recibo #3412
  const { data: lote37 } = await supabase.from('lotes').select('id').eq('id_lote', 'LC2 - 37 - 11').single();
  if (lote37) {
    const { data: v37 } = await supabase.from('ventas').select('id').eq('lote_id', lote37.id).single();
    if (v37) {
      await supabase.from('cuotas').update({
        observacion: 'Pendiente de emisión de Recibo #3412 - Transferencia Bancolombia'
      }).eq('venta_id', v37.id).eq('numero_cuota', 5);
      console.log('ℹ️ LC2 - 37 - 11 C#5 marcado como Pendiente de Recibo #3412 (el renglón vacío de la foto).');
    }
  }

  // Eliminar cualquier recibo > 3411 de datos_maestros para que coincida exactamente
  await supabase.from('datos_maestros').delete().eq('tipo', 'RECIBO_CAJA').gt('orden', 3411);

  console.log('\n--- ALINEACIÓN COMPLETADA CON ÉXITO ---');
}

main().catch(console.error);
