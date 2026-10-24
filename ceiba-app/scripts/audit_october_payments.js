import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  const { data: cuotas, error } = await supabase
    .from('cuotas')
    .select('id, numero_cuota, fecha_vencimiento, fecha_pago, valor_pagado, estado_cuota, observacion, ventas(lotes(id_lote))')
    .gte('fecha_pago', '2026-10-01')
    .lte('fecha_pago', '2026-10-31')
    .order('fecha_pago');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total cuotas con fecha_pago en Octubre 2026: ${cuotas.length}`);
  for (const c of cuotas) {
    const lote = c.ventas?.lotes?.id_lote || '—';
    const cli = c.ventas?.clientes?.nombre_completo || '—';
    const obs = (c.observacion || '').substring(0, 35);
    const val = Number(c.valor_pagado || 0);
    console.log(`${c.fecha_pago} | ${lote.padEnd(25, ' ')} | C#${c.numero_cuota.toString().padStart(2, ' ')} | Venc: ${c.fecha_vencimiento} | $${val.toLocaleString('es-CO').padStart(11, ' ')} | ${obs}`);
  }
}

main().catch(console.error);
