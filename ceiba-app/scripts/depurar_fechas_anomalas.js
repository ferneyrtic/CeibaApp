import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corrections = [
  // 1. LC2 - 27 - 1 (C#3)
  { id: '1d67fc32-41db-4e9b-8395-0c9e4556fab6', lote: 'LC2 - 27 - 1', cuota: 3, fecha_anterior: '2026-12-16', fecha_nueva: '2025-12-16', motivo: 'Typo de año 2026 en vez de 2025 (C2 pagada 21/11/2025, C4 pagada 21/01/2026)' },
  // 2. LC2 - 27 - 10 Y 11 (C#11)
  { id: '9948917b-a5c5-4be7-994d-bc3f8becc013', lote: 'LC2 - 27 - 10 Y 11', cuota: 11, fecha_anterior: '2027-06-29', fecha_nueva: '2026-06-29', motivo: 'Typo de año 2027 en vez de 2026 (C10 pagada 01/06/2026, C12 pagada 31/07/2026)' },
  // 3. LC2 - 30 - 1 (C#3)
  { id: 'dee62d8c-ba8e-425e-86b8-4a1ae1b05627', lote: 'LC2 - 30 - 1', cuota: 3, fecha_anterior: '2026-11-27', fecha_nueva: '2025-11-27', motivo: 'Typo de año 2026 en vez de 2025 (Venta 25/08/2025, C1 pagada 01/09/2025, C4 pagada 25/02/2026)' },
  // 4. LC2 - 30 - 1 (C#2)
  { lote: 'LC2 - 30 - 1', cuota: 2, fecha_anterior: '2026-09-30', fecha_nueva: '2025-09-30', motivo: 'Typo de año 2026 en vez de 2025 (C1 pagada 01/09/2025, C3 pagada 27/11/2025)' },
  // 5. LC2 - 30 - 12 (C#4)
  { id: '3f807a29-727e-4c17-aafc-9e19a2ee9fe6', lote: 'LC2 - 30 - 12', cuota: 4, fecha_anterior: '2026-12-02', fecha_nueva: '2025-12-02', motivo: 'Typo de año 2026 en vez de 2025 (C3 pagada 04/11/2025, C5 pagada 07/01/2026)' },
  // 6. LC2 - 37 - 17 (C#5)
  { id: '9fdd7369-5f2d-4313-a726-fcdf639a32ca', lote: 'LC2 - 37 - 17', cuota: 5, fecha_anterior: '2026-12-26', fecha_nueva: '2025-12-26', motivo: 'Typo de año 2026 en vez de 2025 (C4 pagada 21/11/2025, C6 pagada 21/01/2026)' },
  // 7. LC2 - 38 - 11 (C#5)
  { id: '2c0902f8-49d0-42ed-a0ab-73108925d502', lote: 'LC2 - 38 - 11', cuota: 5, fecha_anterior: '2027-06-12', fecha_nueva: '2026-06-12', motivo: 'Typo de año 2027 en vez de 2026 (C4 pagada 25/05/2026, C6 pagada 14/07/2026)' },
  // 8. LC1 - 2 Y 3 (C#6)
  { id: 'f67d8da2-d456-4734-8a0c-0debf5e888b7', lote: 'LC1 - 2 Y 3', cuota: 6, fecha_anterior: '2026-12-30', fecha_nueva: '2025-12-30', motivo: 'Typo de año 2026 en vez de 2025 (C5 pagada 30/11/2025, C7 pagada 05/02/2026)' },
  // 9. LC1 - 2 - 8 Y 9 (C#3)
  { id: '4fe60890-b930-474b-8eac-434777c12ef0', lote: 'LC1 - 2 - 8 Y 9', cuota: 3, fecha_anterior: '2026-11-12', fecha_nueva: '2025-11-12', motivo: 'Typo de año 2026 en vez de 2025 (C2 pagada 11/10/2025, abono de $3.000.000 cubrió C3 y C4)' },
  // 10. LC1 - 7 - 5 (C#7)
  { id: '0763a1f9-de3b-42cf-bf2d-99387b09b846', lote: 'LC1 - 7 - 5', cuota: 7, fecha_anterior: '2026-12-05', fecha_nueva: '2026-05-12', motivo: 'Inversión día/mes: ingresado como 12/05/2026 (12 de mayo de 2026) interpretado como 5 de diciembre' },
  // 11. LC1 - 14 - 13 Y 14 (C#6)
  { id: 'd94f6f9f-9d8a-42a1-a924-14e5038a2555', lote: 'LC1 - 14 - 13 Y 14', cuota: 6, fecha_anterior: '2026-12-19', fecha_nueva: '2025-12-19', motivo: 'Typo de año 2026 en vez de 2025 (C5 pagada 16/11/2025, C7 pagada 19/01/2026)' },
  // 12. LC1 - 14 - 13 Y 14 (C#4)
  { id: '99d56f14-1ec7-4f8d-801b-cdf8613171f7', lote: 'LC1 - 14 - 13 Y 14', cuota: 4, fecha_anterior: '2026-10-16', fecha_nueva: '2025-10-16', motivo: 'Typo de año 2026 en vez de 2025 (Venc 18/10/2025, C5 pagada 16/11/2025)' },
  // 13. LC1 - 14 - 11 Y 12 (C#4)
  { id: '42595b34-f49b-40ad-9556-7fe225b43773', lote: 'LC1 - 14 - 11 Y 12', cuota: 4, fecha_anterior: '2026-10-16', fecha_nueva: '2025-10-16', motivo: 'Typo de año 2026 en vez de 2025 (Venc 18/10/2025, C5 pagada 16/11/2025)' },
  // 14. LC1 - 15 - 14 (C#3)
  { id: 'b5a1e7ba-352c-4f05-b3cb-1ec3c49ca1f2', lote: 'LC1 - 15 - 14', cuota: 3, fecha_anterior: '2026-11-26', fecha_nueva: '2025-11-26', motivo: 'Typo de año 2026 en vez de 2025 (C2 pagada 26/08/2025, C4 pagada 27/12/2025)' },
  // 15. LC1 - 15 - 14 (C#10)
  { id: '5ad1542d-85a6-40b7-8a63-c6239a7fe668', lote: 'LC1 - 15 - 14', cuota: 10, fecha_anterior: '2826-08-01', fecha_nueva: '2026-08-01', motivo: 'Typo de teclado numérico año 2826 en vez de 2026 (C9 pagada 30/07/2026, C11 pagada 31/08/2026)' },
  // 16. LC1 - 16 - 1 Y 2 (C#3)
  { id: '5d917262-834b-451c-855d-669f8c715da2', lote: 'LC1 - 16 - 1 Y 2', cuota: 3, fecha_anterior: '2026-11-01', fecha_nueva: '2025-11-01', motivo: 'Typo de año 2026 en vez de 2025 (C2 pagada 29/09/2025, C4 pagada 27/11/2025)' },
  // 17. LC1 - 3 - 9 (C#6)
  { lote: 'LC1 - 3 - 9', cuota: 6, fecha_anterior: '2003-02-23', fecha_nueva: '2026-02-23', motivo: 'Typo de año 2003 en vez de 2026 (C5 pagada 10/01/2026, C7 pagada 21/03/2026)' },
];

async function main() {
  console.log('--- APLICANDO DEPURACIÓN RIGUROSA DE FECHAS EN SUPABASE ---');

  for (const c of corrections) {
    let cuotaId = c.id;
    if (!cuotaId) {
      // Find cuota by lote and cuota number
      const { data: lote } = await supabase.from('lotes').select('id').eq('id_lote', c.lote).single();
      if (!lote) {
        console.error(`No se encontró lote ${c.lote}`);
        continue;
      }
      const { data: venta } = await supabase.from('ventas').select('id').eq('lote_id', lote.id).single();
      if (!venta) {
        console.error(`No se encontró venta para ${c.lote}`);
        continue;
      }
      const { data: cuotaRecord } = await supabase.from('cuotas').select('id, fecha_pago').eq('venta_id', venta.id).eq('numero_cuota', c.cuota).single();
      if (cuotaRecord) {
        cuotaId = cuotaRecord.id;
      }
    }

    if (cuotaId) {
      const { error } = await supabase.from('cuotas').update({ fecha_pago: c.fecha_nueva }).eq('id', cuotaId);
      if (error) {
        console.error(`❌ Error actualizando ${c.lote} C#${c.cuota}:`, error);
      } else {
        console.log(`✅ [${c.lote}] C#${c.cuota}: ${c.fecha_anterior} -> ${c.fecha_nueva} (${c.motivo})`);
      }
    }
  }

  // 18. Corregir fecha_venta de LC2 - 44 - 4
  const ventaId = 'c8aa4aa3-74b0-4554-a4f4-a14fe966856b';
  const { error: errVenta } = await supabase.from('ventas').update({ fecha_venta: '2026-07-16' }).eq('id', ventaId);
  if (errVenta) console.error('❌ Error actualizando venta LC2 - 44 - 4:', errVenta);
  else console.log('✅ [LC2 - 44 - 4] fecha_venta corregida de 2027-07-16 a 2026-07-16');

  console.log('\n--- VERIFICANDO QUE NO QUEDEN FECHAS FUTURAS EN CUOTAS ---');
  const { data: futuras } = await supabase.from('cuotas').select('id, numero_cuota, fecha_pago, ventas(lotes(id_lote))').gt('fecha_pago', '2026-10-21');
  console.log(`Cuotas con fecha_pago > 2026-10-21 restantes en Supabase: ${futuras?.length || 0}`);
  if (futuras && futuras.length > 0) {
    console.log(futuras);
  }

  console.log('\n--- VERIFICANDO QUE NO QUEDEN AÑOS ABSURDOS (< 2020) EN FECHA_PAGO ---');
  const { data: antiguas } = await supabase.from('cuotas').select('id, numero_cuota, fecha_pago, ventas(lotes(id_lote))').not('fecha_pago', 'is', null).lt('fecha_pago', '2020-01-01');
  console.log(`Cuotas con fecha_pago < 2020-01-01 restantes en Supabase: ${antiguas?.length || 0}`);
  if (antiguas && antiguas.length > 0) {
    console.log(antiguas);
  }
}

main().catch(console.error);
