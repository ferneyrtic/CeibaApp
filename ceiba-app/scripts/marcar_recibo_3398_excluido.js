import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qatfoxmarddsocnwycgy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log('--- MARCANDO RECIBO #3398 COMO EXCLUIDO DEL CIERRE ---');

  // 1. Obtener registro de datos_maestros tipo RECIBO_CAJA orden 3398
  const { data: dmRecibos, error: err1 } = await supabase
    .from('datos_maestros')
    .select('id, valor')
    .eq('tipo', 'RECIBO_CAJA')
    .eq('orden', 3398);

  if (err1) throw err1;

  if (dmRecibos && dmRecibos.length > 0) {
    const item = dmRecibos[0];
    const parsed = typeof item.valor === 'string' ? JSON.parse(item.valor) : item.valor;
    parsed.excluido_cierre = true;
    parsed.motivo_exclusion_cierre = 'Pago previo ya dejado en corte anterior. Estadística entra desde recibo #3399.';

    const { error: updErr } = await supabase
      .from('datos_maestros')
      .update({ valor: JSON.stringify(parsed) })
      .eq('id', item.id);

    if (updErr) {
      console.error('Error actualizando RECIBO_CAJA 3398 en datos_maestros:', updErr);
    } else {
      console.log('  RECIBO_CAJA #3398 en datos_maestros marcado con excluido_cierre: true.');
    }
  }

  // 2. Actualizar Cuota 10 de LC1 - 11 - 2
  const cuota11_2Id = 'f1ca818b-1c74-4719-bc5f-4fa533c087b2';
  const { data: cuotaData } = await supabase
    .from('cuotas')
    .select('comprobante_url')
    .eq('id', cuota11_2Id)
    .single();

  if (cuotaData && cuotaData.comprobante_url) {
    try {
      const arr = JSON.parse(cuotaData.comprobante_url);
      arr.forEach(r => {
        if (Number(r.numero_recibo) === 3398) {
          r.excluido_cierre = true;
          r.motivo_exclusion_cierre = 'Pago previo ya dejado en corte anterior. Estadística entra desde recibo #3399.';
        }
      });
      await supabase
        .from('cuotas')
        .update({
          comprobante_url: JSON.stringify(arr),
          observacion: 'Recibo #3398 (Excluido de Cierre - Dejado en corte previo) - Transferencia Bancolombia'
        })
        .eq('id', cuota11_2Id);
      console.log('  Cuota 10 de LC1 - 11 - 2 comprobante_url y observacion actualizados.');
    } catch (e) {
      console.warn('Aviso parseando comprobante_url:', e);
    }
  }

  console.log('\n✅ RECIBO #3398 MARCADOR DE EXCLUSIÓN DE CIERRE COMPLETADO');
}

main().catch(console.error);
