import { supabase } from '../supabase';

export const getClientes = async (search = '') => {
  let query = supabase
    .from('clientes')
    .select('*')
    .order('nombre', { ascending: true });

  if (search) query = query.or(`nombre.ilike.%${search}%,doc_cliente.ilike.%${search}%,ciudad.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getClienteById = async (id) => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*, ventas(id, precio_venta, saldo, estado, lotes(id_lote))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const createCliente = async (cliente) => {
  const { data, error } = await supabase
    .from('clientes').insert(cliente).select().single();
  if (error) throw error;
  return data;
};

export const updateCliente = async (id, updates) => {
  const { data, error } = await supabase
    .from('clientes').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};
