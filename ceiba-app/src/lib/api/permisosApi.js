import { supabase } from '../supabase.js';
import { registrarAccion } from './auditApi.js';

const STORAGE_KEY = 'ceiba_permisos_config_cache';

export const PERMISSION_CATALOG = [
  {
    category: 'Finanzas & Recaudos',
    items: [
      { key: 'canViewRecibos', label: 'Ver Listado de Recibos', desc: 'Permite consultar el historial de recibos oficiales emitidos' },
      { key: 'canManageRecibos', label: 'Emitir Recibos de Caja', desc: 'Permite registrar nuevos pagos y emitir recibos oficiales' },
      { key: 'canDeleteRecibos', label: 'Anular / Eliminar Recibos', desc: 'Permite anular o revertir recibos oficiales de caja' },
      { key: 'canViewCierre', label: 'Acceso a Cierre Mensual', desc: 'Visualizar recaudos esperados, metas mensuales y proyección' },
      { key: 'canViewGastos', label: 'Ver Gastos de Obra', desc: 'Consultar compras de materiales, nómina de obra y costos de desarrollo' },
      { key: 'canManageGastos', label: 'Gestionar Gastos de Obra', desc: 'Registrar, editar o anular facturas y egresos de obra' },
    ]
  },
  {
    category: 'Comisiones & Nómina',
    items: [
      { key: 'canViewComisiones', label: 'Ver Nómina de Comisiones', desc: 'Consultar comisiones ganadas y balance de asesores' },
      { key: 'canDisburseCommissions', label: 'Desembolsar Comisiones', desc: 'Registrar pagos y transferencias a comisionistas' },
    ]
  },
  {
    category: 'Gestión Contractual & Cartera',
    items: [
      { key: 'canEditContrato', label: 'Editar Datos de Contrato', desc: 'Modificar condiciones de venta, precios, cuotas y plazos' },
      { key: 'canDeleteCasosEspeciales', label: 'Gestionar Casos Especiales', desc: 'Crear, editar o levantar acuerdos y notas de cobranza especial' },
    ]
  },
  {
    category: 'Auditoría & Sistema',
    items: [
      { key: 'canViewHistorialAcciones', label: 'Ver Historial de Auditoría', desc: 'Consultar trazabilidad de modificaciones operativas' },
      { key: 'canViewConfig', label: 'Acceso a Configuración', desc: 'Entrar a preferencias, estado del sistema y perfil' },
    ]
  }
];

let inMemoryPermisos = null;

/**
 * Obtiene los permisos personalizados persistidos en datos_maestros o localStorage.
 */
export async function getPermisosPersonalizados(forceRefresh = false) {
  if (!forceRefresh && inMemoryPermisos) {
    return inMemoryPermisos;
  }

  let config = {};

  try {
    const { data, error } = await supabase
      .from('datos_maestros')
      .select('id, valor')
      .eq('tipo', 'CONFIG_PERMISOS')
      .limit(1);

    if (!error && data && data.length > 0) {
      const raw = data[0].valor;
      config = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      }
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const cached = window.localStorage.getItem(STORAGE_KEY);
      if (cached) {
        config = JSON.parse(cached);
      }
    }
  } catch (err) {
    console.warn('Error obteniendo configuración de permisos:', err);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = window.localStorage.getItem(STORAGE_KEY);
        if (cached) config = JSON.parse(cached);
      } catch (e) {}
    }
  }

  inMemoryPermisos = config;
  return config;
}

/**
 * Guarda la configuración de permisos para un rol específico.
 * Incluye validaciones de jerarquía:
 * - Contadora no puede modificar roles de Admin ni Propietario.
 * - Admin tiene permisos absolutos y no puede ser bloqueado.
 */
export async function guardarPermisosRol({ targetRole, nuevosPermisos, editorUser, defaultPermissions }) {
  if (!targetRole) {
    throw new Error('El rol objetivo es requerido');
  }

  const editorRole = (editorUser?.user_metadata?.role || editorUser?.role || '').toLowerCase();
  const esAdmin = editorRole === 'admin' || (editorUser?.email || '').toLowerCase().startsWith('admin');
  const esContadora = editorRole === 'contadora' || (editorUser?.email || '').toLowerCase().startsWith('contadora');

  if (!esAdmin && !esContadora) {
    throw new Error('No tienes autorización para modificar permisos de usuarios');
  }

  // La contadora NO puede modificar Administradores ni Propietarios
  if (!esAdmin && (targetRole === 'admin' || targetRole === 'propietario')) {
    throw new Error('Solo los Administradores pueden modificar roles directivos');
  }

  // Admin siempre conserva todos los permisos en true
  if (targetRole === 'admin') {
    for (const cat of PERMISSION_CATALOG) {
      for (const item of cat.items) {
        nuevosPermisos[item.key] = true;
      }
    }
    nuevosPermisos.canManageUsers = true;
    nuevosPermisos.canManagePermissions = true;
  }

  const configActual = await getPermisosPersonalizados(true);
  const mapaActualizado = {
    ...configActual,
    [targetRole]: {
      ...(defaultPermissions || {}),
      ...(configActual[targetRole] || {}),
      ...nuevosPermisos
    }
  };

  try {
    const { data: existing } = await supabase
      .from('datos_maestros')
      .select('id')
      .eq('tipo', 'CONFIG_PERMISOS')
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('datos_maestros')
        .update({
          valor: JSON.stringify(mapaActualizado),
          descripcion: 'Configuración dinámica de permisos por rol'
        })
        .eq('id', existing[0].id);
    } else {
      await supabase
        .from('datos_maestros')
        .insert([{
          tipo: 'CONFIG_PERMISOS',
          orden: 1,
          descripcion: 'Configuración dinámica de permisos por rol',
          valor: JSON.stringify(mapaActualizado)
        }]);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mapaActualizado));
    }
    inMemoryPermisos = mapaActualizado;

    // Registrar en auditoría
    const editorNombre = typeof editorUser === 'object'
      ? (editorUser?.user_metadata?.nombre || editorUser?.nombre || editorUser?.email || 'Contadora')
      : (editorUser || 'Contadora');

    const rolLabel = targetRole.toUpperCase();
    await registrarAccion({
      modulo: 'CONFIGURACION',
      accion: 'ACTUALIZAR_PERMISOS',
      lote_id_str: '—',
      cliente_nombre: 'Control de Acceso',
      descripcion: `Modificación de permisos para el rol ${rolLabel} por ${editorNombre}`,
      detalles: {
        rol_modificado: targetRole,
        permisos_actualizados: nuevosPermisos,
        modificado_por: editorNombre
      },
      usuario: editorUser
    });

    return { success: true, config: mapaActualizado };
  } catch (err) {
    console.error('Error guardando permisos en Supabase:', err);
    throw err;
  }
}

/**
 * Restablece los permisos de un rol a sus valores predeterminados de fábrica.
 */
export async function restablecerPermisosRol({ targetRole, editorUser, defaultPermissions }) {
  const configActual = await getPermisosPersonalizados(true);
  const copia = { ...configActual };
  delete copia[targetRole];

  try {
    const { data: existing } = await supabase
      .from('datos_maestros')
      .select('id')
      .eq('tipo', 'CONFIG_PERMISOS')
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('datos_maestros')
        .update({
          valor: JSON.stringify(copia)
        })
        .eq('id', existing[0].id);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(copia));
    }
    inMemoryPermisos = copia;

    const editorNombre = typeof editorUser === 'object'
      ? (editorUser?.user_metadata?.nombre || editorUser?.nombre || editorUser?.email || 'Contadora')
      : (editorUser || 'Contadora');

    await registrarAccion({
      modulo: 'CONFIGURACION',
      accion: 'RESTABLECER_PERMISOS',
      lote_id_str: '—',
      cliente_nombre: 'Control de Acceso',
      descripcion: `Permisos del rol ${targetRole.toUpperCase()} restablecidos a valores por defecto por ${editorNombre}`,
      detalles: {
        rol_restablecido: targetRole,
        modificado_por: editorNombre
      },
      usuario: editorUser
    });

    return { success: true, config: copia };
  } catch (err) {
    console.error('Error restableciendo permisos:', err);
    throw err;
  }
}
