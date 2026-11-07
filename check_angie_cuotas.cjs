const { createClient } = require('./ceiba-app/node_modules/@supabase/supabase-js');
const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCuotas() {
  const ventasIds = ['958a6457-47cc-4596-8847-2315da9185fc', '32290e39-261f-463c-a8fe-7581fedbc8f1'];

  for (const vid of ventasIds) {
    const { data: v } = await supabase.from('ventas').select('*, lotes(*)').eq('id', vid).single();
    console.log('\n=============================================');
    console.log('VENTA:', v.lotes?.id_lote, 'dias_pago:', v.dias_pago, 'cuota pactada:', v.valor_cuota);

    const { data: cuotas } = await supabase.from('cuotas').select('*').eq('venta_id', vid).order('numero_cuota', { ascending: true });
    cuotas.forEach(c => {
      console.log('C' + c.numero_cuota + ': Venc=' + c.fecha_vencimiento + ' | Pago=' + c.fecha_pago + ' | Pagado=' + c.valor_pagado + ' | Cuota=' + c.valor_cuota + ' | Estado=' + c.estado_cuota + ' | Obs=' + c.observacion);
    });
  }
}
checkCuotas();
