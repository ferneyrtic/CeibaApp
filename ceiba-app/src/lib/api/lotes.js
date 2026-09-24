import { supabase } from '../supabase';

export const getLotes = async ({ estado, search } = {}) => {
  let query = supabase
    .from('lotes')
    .select('*, proyectos(nombre), ventas(id, estado, saldo)')
    .order('manzana', { ascending: true })
    .order('lote', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  // Si la venta asociada está como PAGADO EN SU TOTALIDAD, reflejarlo en el lote
  const mapped = (data || []).map(l => {
    const v = Array.isArray(l.ventas) ? l.ventas[0] : l.ventas;
    if (v?.estado === 'PAGADO EN SU TOTALIDAD' || v?.estado === 'PAGADO') {
      return { ...l, estado: 'PAGADO EN SU TOTALIDAD' };
    }
    return l;
  });

  if (estado && estado !== 'Todos') {
    return mapped.filter(l => l.estado === estado);
  }
  if (search) {
    const s = search.toLowerCase();
    return mapped.filter(l => l.id_lote?.toLowerCase().includes(s));
  }

  return mapped;
};

export const getLoteById = async (id) => {
  const { data, error } = await supabase
    .from('lotes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const createLote = async (lote) => {
  const { data, error } = await supabase.from('lotes').insert(lote).select().single();
  if (error) throw error;
  return data;
};

export const updateLote = async (id, updates) => {
  let loteUpdates = { ...updates };
  let esPagadoTotal = false;

  if (updates.estado === 'PAGADO EN SU TOTALIDAD' || updates.estado === 'PAGADO' || updates.estado === 'SALDADO') {
    esPagadoTotal = true;
    // La restricción de tabla lotes acepta 'VENDIDO'
    loteUpdates.estado = 'VENDIDO';
  } else if (loteUpdates.estado === 'EN NEGOCIACION') {
    loteUpdates.estado = 'EN NEGOCIACIÓN';
  }

  const { data, error } = await supabase
    .from('lotes').update(loteUpdates).eq('id', id).select().single();
  if (error) throw error;

  // Sincronizar estado en ventas
  if (updates.estado) {
    try {
      const estadoVenta = esPagadoTotal ? 'PAGADO EN SU TOTALIDAD' : loteUpdates.estado;
      await supabase
        .from('ventas')
        .update({ estado: estadoVenta })
        .eq('lote_id', id);
    } catch (e) {
      console.warn('Sync ventas warning:', e);
    }
  }

  if (esPagadoTotal && data) {
    data.estado = 'PAGADO EN SU TOTALIDAD';
  }

  return data;
};



export const deleteLote = async (id) => {
  const { error } = await supabase.from('lotes').delete().eq('id', id);
  if (error) throw error;
};

export const getEstadisticasLotes = async () => {
  const { data, error } = await supabase
    .from('lotes')
    .select('estado');
  if (error) throw error;

  const stats = {};
  data.forEach(l => { stats[l.estado] = (stats[l.estado] || 0) + 1; });
  return stats;
};
