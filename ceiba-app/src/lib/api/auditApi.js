import * as sbModule from '../supabase.js';
const supabase = sbModule.supabase;
const supabaseAdmin = sbModule.supabaseAdmin || sbModule.supabase;

const CACHE_KEY = 'ceiba_audit_logs_cache';
let inMemoryLogs = [];

/**
 * Detecta si un log pertenece exclusivamente a los casos de prueba de Juan Pérez o María Rodríguez.
 */
export function isTestAuditLog(log) {
  if (!log) return false;
  const s = `${log.cliente_nombre || ''} ${log.lote_id_str || ''} ${log.descripcion || ''} ${JSON.stringify(log.detalles || '')}`.toLowerCase();
  return (
    s.includes('juan perez (prueba)') ||
    s.includes('maria rodriguez (prueba)') ||
    s.includes('test - 01') ||
    s.includes('test - 02') ||
    s.includes('test - 03') ||
    s.includes('1111222333') ||
    s.includes('4444555666')
  );
}

/**
 * Detecta si un log es anómalo o inválido.
 * Solo filtra datos de prueba claramente identificados.
 * ⚠️ IMPORTANTE: Esta función NO debe filtrar logs legítimos de Soporte Mora, Secretaría
 *    ni ningún otro usuario real. En caso de duda, NO filtrar.
 */
export function isInvalidOrAnomalousLog(log) {
  if (!log) return true;
  if (isTestAuditLog(log)) return true;

  // Solo filtrar cláusulas contractuales numéricas específicas que se sabe que no son logs de gestión real
  const desc = `${log.descripcion || ''} ${JSON.stringify(log.detalles || '')}`.toLowerCase();
  if (
    desc.includes('32.202.000') ||
    desc.includes('52.663.000') ||
    desc.includes('treinta y dos millones') ||
    desc.includes('cincuenta y dos millones')
  ) return true;

  return false;
}

/**
 * Obtiene el usuario activo actual desde Supabase auth o del localStorage.
 */
function getCurrentUserInfo() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Intentar cualquier clave auth de supabase en localStorage
      let sessionStr = null;
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          sessionStr = window.localStorage.getItem(key);
          break;
        }
      }
      if (!sessionStr) {
        sessionStr = window.localStorage.getItem('sb-qatfoxmarddsocnwycgy-auth-token');
      }

      if (sessionStr) {
        const parsed = JSON.parse(sessionStr);
        const user = parsed?.user;
        if (user) {
          const nombre = user.user_metadata?.nombre || (user.email ? user.email.split('@')[0] : 'Secretaría');
          const role = user.user_metadata?.role || 'secretaria';
          return {
            email: user.email || 'secretaria@ceiba.com',
            nombre: nombre,
            role: role
          };
        }
      }
    }
  } catch (e) {
    // Silently continue to fallback
  }

  return {
    email: 'secretaria@laceiba.com',
    nombre: 'Secretaría',
    role: 'secretaria'
  };
}

/**
 * Registra una acción operativa en el historial de auditoría.
 * Guarda en la tabla `datos_maestros` de Supabase y en la caché local.
 * ⚠️ CRÍTICO: Si `throwOnFailure=true` (default), lanza un error si Supabase falla,
 *    para que la acción que invoca pueda revertirse y el usuario sea notificado.
 *    NUNCA se debe permitir que una acción quede sin registro silenciosamente.
 *
 * @param {Object} params
 * @param {string} params.modulo - 'ABONOS_EXTRAORDINARIOS' | 'CARTERA' | 'LOTES' | 'CUOTAS' | 'CASOS_ESPECIALES'
 * @param {string} params.accion - Tipo de acción realizada
 * @param {string} [params.lote_id_str] - Ej: 'LC2 - 41 - 16'
 * @param {string|number} [params.lote_id] - ID interno del lote
 * @param {string} [params.cliente_nombre] - Nombre del cliente
 * @param {string} params.descripcion - Resumen legible en español
 * @param {Object} [params.detalles] - Snapshot técnico de cuotas, montos, etc.
 * @param {Object} [params.usuario] - Información de usuario que ejecutó la acción (opcional)
 * @param {boolean} [params.throwOnFailure=true] - Si true, lanza error cuando Supabase no puede guardar el log.
 */
export async function registrarAccion({
  modulo,
  accion,
  lote_id_str = '',
  lote_id = null,
  cliente_nombre = '',
  descripcion,
  detalles = {},
  usuario = null,
  throwOnFailure = true
}) {
  const userInfo = usuario || getCurrentUserInfo();
  const timestamp = new Date().toISOString();

  const record = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp,
    modulo: modulo || 'GENERAL',
    accion: accion || 'ACCION_GENERAL',
    lote_id_str: lote_id_str || '—',
    lote_id: lote_id || null,
    cliente_nombre: cliente_nombre || '—',
    usuario_email: userInfo.email,
    usuario_nombre: userInfo.nombre,
    usuario_rol: userInfo.role,
    descripcion: descripcion || 'Acción registrada en el sistema',
    detalles: detalles || {}
  };

  // No registrar logs para casos de prueba o anómalos
  if (isInvalidOrAnomalousLog(record)) {
    return null;
  }

  // 1. Persistir PRIMERO en Supabase — si falla, se rechaza toda la operación.
  //    El registro en memoria/localStorage solo ocurre si Supabase confirma.
  let persistError = null;
  try {
    const client = supabaseAdmin || supabase;
    if (!client || typeof client.from !== 'function') {
      throw new Error('No hay cliente Supabase disponible para guardar la auditoría.');
    }
    const fromObj = client.from('datos_maestros');
    if (!fromObj || typeof fromObj.insert !== 'function') {
      throw new Error('La tabla datos_maestros no está disponible.');
    }
    const insertQuery = fromObj.insert({
      tipo: 'AUDITORIA_ACCION',
      valor: JSON.stringify(record),
      orden: Math.floor(Date.now() / 1000)
    });
    const { data: insData, error } = typeof insertQuery?.select === 'function'
      ? await insertQuery.select('id')
      : await insertQuery;

    if (error) {
      persistError = error;
    } else if (insData && insData[0]) {
      record.db_id = insData[0].id;
    }
  } catch (err) {
    persistError = err;
  }

  if (persistError) {
    const msg = `⚠️ No se pudo guardar el registro de auditoría en la base de datos. La acción fue rechazada para garantizar trazabilidad completa. Error: ${persistError.message || JSON.stringify(persistError)}`;
    console.error('[AUDIT CRÍTICO]', msg, persistError);
    if (throwOnFailure) {
      throw new Error(msg);
    }
    // Solo si se pide ignorar el fallo (ej: logs internos del sistema), guardar localmente de respaldo
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '[]');
        cached.unshift({ ...record, _persistFailed: true });
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(cached.slice(0, 300)));
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  // 2. Solo si Supabase confirmó: guardar en memoria y caché local (para respuesta instantánea)
  inMemoryLogs.unshift(record);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '[]');
      cached.unshift(record);
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(cached.slice(0, 300)));
    } catch (e) {
      console.warn('Error guardando en caché local de logs:', e);
    }
  }

  return record;
}

/**
 * Consulta el historial de acciones con filtros y paginación.
 * Lee directamente desde Supabase (fuente de verdad) y usa el caché local como respaldo offline.
 */
export async function getHistorialAcciones({ limit = 1000, modulo, lote, search } = {}) {
  let logs = [];

  // 1. Cargar desde Supabase (fuente de verdad central) — ordenar por fecha desc directamente en DB
  try {
    const client = supabaseAdmin || supabase;
    // Traer hasta 2000 registros; la columna "orden" ahora almacena Date.now() (ms epoch),
    // por lo que ordenar descendente por orden nos da el más reciente primero.
    const { data, error } = await client
      .from('datos_maestros')
      .select('id, tipo, valor, orden')
      .eq('tipo', 'AUDITORIA_ACCION')
      .order('orden', { ascending: false })
      .limit(2000);

    if (!error && data && data.length > 0) {
      logs = data.map(d => {
        try {
          const parsed = typeof d.valor === 'string' ? JSON.parse(d.valor) : d.valor;
          return { ...parsed, db_id: d.id, _db_orden: d.orden };
        } catch {
          return null;
        }
      }).filter(Boolean).filter(l => !isInvalidOrAnomalousLog(l));

      // Mantener la caché local actualizada con la verdad central de la base de datos
      if (typeof window !== 'undefined' && window.localStorage && logs.length > 0) {
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(logs.slice(0, 300)));
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {
    console.warn('Error leyendo logs de Supabase, usando caché local:', e);
  }

  // 2. Si Supabase viene vacío o falló la conexión, usar caché local
  if (logs.length === 0) {
    const fallbackList = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const local = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '[]');
        if (Array.isArray(local)) {
          const cleaned = local.filter(l => !isInvalidOrAnomalousLog(l));
          fallbackList.push(...cleaned);
        }
      } catch {
        // ignore
      }
    }
    fallbackList.push(...inMemoryLogs.filter(l => !isInvalidOrAnomalousLog(l)));
    logs = fallbackList;
  } else {
    // Si Supabase trajo datos, incorporar únicamente logs recién creados en memoria que aún no se hayan propagado
    const existingIds = new Set(logs.map(l => l.id));
    for (const item of inMemoryLogs) {
      if (!existingIds.has(item.id) && !isInvalidOrAnomalousLog(item)) {
        logs.unshift(item);
      }
    }
  }

  // Filtrar de forma estricta cualquier log residual de prueba o anómalo
  logs = logs.filter(l => !isInvalidOrAnomalousLog(l));

  // Ordenar por fecha descendente
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Aplicar filtros en memoria
  if (modulo && modulo !== 'Todos') {
    logs = logs.filter(l => l.modulo === modulo);
  }

  if (lote) {
    const lUpper = lote.toUpperCase().replace(/\s+/g, '');
    logs = logs.filter(l => (l.lote_id_str || '').toUpperCase().replace(/\s+/g, '').includes(lUpper));
  }

  if (search && search.trim()) {
    const s = search.toLowerCase().trim();
    logs = logs.filter(l =>
      (l.descripcion && l.descripcion.toLowerCase().includes(s)) ||
      (l.lote_id_str && l.lote_id_str.toLowerCase().includes(s)) ||
      (l.cliente_nombre && l.cliente_nombre.toLowerCase().includes(s)) ||
      (l.usuario_nombre && l.usuario_nombre.toLowerCase().includes(s)) ||
      (l.usuario_email && l.usuario_email.toLowerCase().includes(s)) ||
      (l.accion && l.accion.toLowerCase().includes(s))
    );
  }

  return logs.slice(0, limit);
}

/**
 * Exporta el historial de acciones filtrado a un archivo Excel.
 */
export async function exportarHistorialExcel(logs, nombreArchivo) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const rows = logs.map((log, idx) => ({
    '#': idx + 1,
    'FECHA Y HORA': new Date(log.timestamp).toLocaleString('es-CO'),
    'MÓDULO': log.modulo,
    'ACCIÓN': log.accion,
    'LOTE': log.lote_id_str,
    'CLIENTE': log.cliente_nombre,
    'USUARIO': log.usuario_nombre,
    'EMAIL': log.usuario_email,
    'DESCRIPCIÓN DE LA ACCIÓN': log.descripcion,
    'DETALLES TÉCNICOS': log.detalles ? JSON.stringify(log.detalles) : ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto ancho de columnas
  const cols = [
    { wch: 5 },  // #
    { wch: 20 }, // Fecha
    { wch: 22 }, // Modulo
    { wch: 25 }, // Accion
    { wch: 18 }, // Lote
    { wch: 30 }, // Cliente
    { wch: 22 }, // Usuario
    { wch: 25 }, // Email
    { wch: 60 }, // Descripcion
    { wch: 40 }  // Detalles
  ];
  ws['!cols'] = cols;

  XLSX.utils.book_append_sheet(wb, ws, 'Historial de Auditoría');
  const fileName = nombreArchivo || `Auditoria_Acciones_LaCeiba_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
