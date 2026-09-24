import { supabase } from '../supabase';

export const getVentas = async ({ search, estado } = {}) => {
  let query = supabase
    .from('ventas')
    .select(`
      *,
      lotes (id_lote, manzana, lote, area_m2),
      clientes (nombre, celular, ciudad, doc_cliente)
    `)
    .order('created_at', { ascending: false });

  if (estado && estado !== 'Todos') query = query.eq('estado', estado);

  const { data, error } = await query;
  if (error) throw error;

  // Filtro de búsqueda en cliente o lote
  if (search) {
    const s = search.toLowerCase();
    return data.filter(v =>
      v.lotes?.id_lote?.toLowerCase().includes(s) ||
      v.clientes?.nombre?.toLowerCase().includes(s) ||
      v.vendedor_nombre?.toLowerCase().includes(s)
    );
  }
  return data;
};

export const getVentaById = async (id) => {
  const { data, error } = await supabase
    .from('ventas')
    .select('*, lotes(*), clientes(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const createVenta = async (venta) => {
  const { data, error } = await supabase
    .from('ventas').insert(venta).select().single();
  if (error) throw error;

  // Auto-generar cuotas usando la función SQL
  await supabase.rpc('generar_cuotas', { p_venta_id: data.id });

  // Marcar el lote como VENDIDO
  if (venta.lote_id) {
    await supabase
      .from('lotes')
      .update({ estado: 'VENDIDO', precio_venta: venta.precio_venta })
      .eq('id', venta.lote_id);
  }

  return data;
};

export const updateVenta = async (id, updates) => {
  const { data, error } = await supabase
    .from('ventas').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};
