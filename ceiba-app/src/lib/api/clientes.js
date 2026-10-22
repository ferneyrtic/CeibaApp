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
  if (cliente.doc_cliente) {
    const rawDoc = String(cliente.doc_cliente).trim();
    cliente.doc_cliente = rawDoc;

    // Verificar si ya existe un cliente con este documento
    const { data: existing } = await supabase
      .from('clientes')
      .select('id, nombre, doc_cliente, ventas(id)')
      .eq('doc_cliente', rawDoc)
      .maybeSingle();

    if (existing) {
      if (!existing.ventas || existing.ventas.length === 0) {
        // Registro huérfano: lo reutilizamos y actualizamos
        const { data, error } = await supabase
          .from('clientes')
          .update(cliente)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        return existing;
      }
    }
  }

  const { data, error } = await supabase
    .from('clientes').insert(cliente).select().single();
  if (error) {
    if (error.code === '23505' || error.message?.includes('clientes_doc_cliente_key')) {
      throw new Error(`La cédula "${cliente.doc_cliente}" ya se encuentra registrada en el sistema.`);
    }
    throw error;
  }
  return data;
};

export const updateCliente = async (id, updates) => {
  if (updates.doc_cliente) {
    const rawDoc = String(updates.doc_cliente).trim();
    updates.doc_cliente = rawDoc;

    // 1. Verificar si otro registro de cliente ya tiene este doc_cliente
    const { data: existingClients, error: checkErr } = await supabase
      .from('clientes')
      .select('id, nombre, doc_cliente, celular, ciudad, direccion, ventas(id)')
      .eq('doc_cliente', rawDoc)
      .neq('id', id);

    if (!checkErr && existingClients && existingClients.length > 0) {
      for (const existing of existingClients) {
        const hasVentas = existing.ventas && existing.ventas.length > 0;

        if (!hasVentas) {
          // Cliente huérfano (sin lotes/ventas vinculadas): eliminar de forma segura para no bloquear la actualización
          await supabase.from('clientes').delete().eq('id', existing.id);
        } else {
          // Cliente activo con contratos. Comprobar si se trata de la misma persona
          const name1 = (updates.nombre || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const name2 = (existing.nombre || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

          const words1 = name1.split(/[^A-Z0-9]+/).filter(w => w.length >= 4);
          const words2 = name2.split(/[^A-Z0-9]+/).filter(w => w.length >= 4);
          const hasCommonWord = words1.some(w => words2.includes(w));

          if (hasCommonWord) {
            // Mismo cliente titular con múltiples lotes: unificar contratos
            await supabase.from('ventas').update({ cliente_id: existing.id }).eq('cliente_id', id);

            const mergedUpdates = {};
            if (updates.celular && !existing.celular) mergedUpdates.celular = updates.celular;
            if (updates.ciudad && !existing.ciudad) mergedUpdates.ciudad = updates.ciudad;
            if (updates.direccion && !existing.direccion) mergedUpdates.direccion = updates.direccion;
            if (Object.keys(mergedUpdates).length > 0) {
              await supabase.from('clientes').update(mergedUpdates).eq('id', existing.id);
            }

            // Eliminar el registro duplicado que ya quedó sin contratos
            await supabase.from('clientes').delete().eq('id', id);

            const { data: unifiedClient } = await supabase
              .from('clientes')
              .select('*')
              .eq('id', existing.id)
              .single();
            return unifiedClient;
          } else {
            // Cédula asignada a otra persona diferente con contratos activos
            throw new Error(
              `La cédula ${rawDoc} ya está registrada a nombre de "${existing.nombre}". Si no es la misma persona, verifique el número de documento.`
            );
          }
        }
      }
    }

    // 2. Limpiar registros huérfanos con formato con puntos del mismo documento (ej: 1.122.133.824)
    const digitsOnly = rawDoc.replace(/\D/g, '');
    if (digitsOnly.length >= 6) {
      const { data: dottedOrphans } = await supabase
        .from('clientes')
        .select('id, doc_cliente, ventas(id)')
        .neq('id', id)
        .ilike('doc_cliente', `%${digitsOnly}%`);

      if (dottedOrphans) {
        for (const orphan of dottedOrphans) {
          const orphanDigits = (orphan.doc_cliente || '').replace(/\D/g, '');
          if (orphanDigits === digitsOnly && (!orphan.ventas || orphan.ventas.length === 0)) {
            await supabase.from('clientes').delete().eq('id', orphan.id);
          }
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('clientes').update(updates).eq('id', id).select().single();
  if (error) {
    if (error.code === '23505' || error.message?.includes('clientes_doc_cliente_key')) {
      throw new Error(`La cédula "${updates.doc_cliente}" ya se encuentra registrada.`);
    }
    throw error;
  }
  return data;
};
