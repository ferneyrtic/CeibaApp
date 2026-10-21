import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log('--- CORRIGIENDO FECHAS HISTÓRICAS DE LC2 - 41 - 11 Y LIMPIANDO TEST - 01 ---');

  // 1. Corregir LC2 - 41 - 11 (pagos reales ocurridos en Octubre de 2025, no 2026)
  const cuota4Id = 'b886874f-2094-434f-ab41-fc7e9e85aac5';
  const cuota6Id = '14f44cfd-cc7a-448c-bb62-5dba3541b011';

  const { error: errC4 } = await supabase
    .from('cuotas')
    .update({ fecha_pago: '2025-10-23' })
    .eq('id', cuota4Id);

  if (errC4) console.error('Error actualizando cuota 4 de LC2 - 41 - 11:', errC4);
  else console.log('  ✅ Cuota #4 de LC2 - 41 - 11 corregida a fecha_pago: 2025-10-23');

  const { error: errC6 } = await supabase
    .from('cuotas')
    .update({ fecha_pago: '2025-10-24' })
    .eq('id', cuota6Id);

  if (errC6) console.error('Error actualizando cuota 6 de LC2 - 41 - 11:', errC6);
  else console.log('  ✅ Cuota #6 de LC2 - 41 - 11 corregida a fecha_pago: 2025-10-24');

  // 2. Limpiar cuotas de prueba de TEST - 01
  const testCuota7 = 'fac9b120-85f6-4a58-9fa3-73130dcf07ac';
  const testCuota8 = '504523d5-d1c2-4a35-9862-e03e46d26248';

  await supabase
    .from('cuotas')
    .update({
      fecha_pago: null,
      valor_pagado: 0.0,
      estado_cuota: 'AL DÍA',
      observacion: null,
      comprobante_url: null
    })
    .in('id', [testCuota7, testCuota8]);

  console.log('  ✅ Cuotas de prueba 7 y 8 de TEST - 01 limpiadas.');

  console.log('\n--- CORRECCIÓN COMPLETADA ---');
}

main().catch(console.error);
