const { createClient } = require('./ceiba-app/node_modules/@supabase/supabase-js');
const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VENTA_ID = '98ab1e47-d704-40e8-9dd6-7ef8194ea510';
const LOTE_ID = '5c6e2847-fe61-417a-96bd-e0bb6aca07bc';

const FECHAS_CUOTAS = [
  '2026-11-05',
  '2026-12-05',
  '2027-01-05',
  '2027-02-05',
  '2027-03-05',
  '2027-04-05',
  '2027-05-05',
  '2027-06-05',
  '2027-07-05',
  '2027-08-05',
  '2027-09-05',
  '2027-10-05',
  '2027-11-05',
  '2027-12-05',
  '2028-01-05',
  '2028-02-05',
  '2028-03-05',
  '2028-04-05',
  '2028-05-05',
  '2028-06-05',
  '2028-07-05',
  '2028-08-05',
  '2028-09-05',
  '2028-10-05'
];

async function run() {
  console.log('=== 1. ACTUALIZAR VENTA LC1 - 19 - 10 ===');
  const { error: errVenta } = await supabase.from('ventas').update({
    dias_pago: '05 DE CADA MES'
  }).eq('id', VENTA_ID);

  if (errVenta) console.error('Error actualizando venta:', errVenta);
  else console.log('✓ Venta actualizada: dias_pago = 05 DE CADA MES');

  console.log('\n=== 2. OBTENER CUOTAS ACTUALES DE LA VENTA ===');
  const { data: cuotas, error: errC } = await supabase.from('cuotas')
    .select('*')
    .eq('venta_id', VENTA_ID)
    .order('numero_cuota', { ascending: true });

  if (errC) {
    console.error('Error obteniendo cuotas:', errC);
    return;
  }

  console.log(`Encontradas ${cuotas.length} cuotas.`);

  console.log('\n=== 3. ACTUALIZAR FECHAS DE LAS 24 CUOTAS ===');
  for (let i = 0; i < cuotas.length; i++) {
    const c = cuotas[i];
    const num = c.numero_cuota || (i + 1);
    const nuevaFecha = FECHAS_CUOTAS[num - 1];
    const nuevoEstado = num === 1 ? 'VENCIDA' : 'AL DÍA';

    const { error: errUp } = await supabase.from('cuotas').update({
      fecha_vencimiento: nuevaFecha,
      estado_cuota: nuevoEstado
    }).eq('id', c.id);

    if (errUp) {
      console.error(`Error actualizando cuota ${num}:`, errUp);
    } else {
      console.log(`✓ Cuota ${num}: Vencimiento = ${nuevaFecha}, Estado = ${nuevoEstado}`);
    }
  }

  console.log('\n=== VERIFICACIÓN FINAL EN SUPABASE ===');
  const { data: updated } = await supabase.from('cuotas')
    .select('numero_cuota, fecha_vencimiento, estado_cuota, valor_cuota')
    .eq('venta_id', VENTA_ID)
    .order('numero_cuota', { ascending: true });
  console.log(updated);
}

run();
