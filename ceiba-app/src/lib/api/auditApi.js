import { supabase } from '../supabase';

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
 */
export async function registrarAccion({
  modulo,
  accion,
  lote_id_str = '',
  lote_id = null,
  cliente_nombre = '',
  descripcion,
  detalles = {},
  usuario = null
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

  // No registrar logs para casos de prueba
  if (isTestAuditLog(record)) {
    return null;
  }

  // 1. Guardar en memoria
  inMemoryLogs.unshift(record);

  // 2. Guardar en caché local si existe window
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '[]');
      cached.unshift(record);
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(cached.slice(0, 300)));
    } catch (e) {
      console.warn('Error guardando en caché de logs:', e);
    }
  }

  // 3. Persistir en Supabase en `datos_maestros`
  try {
    if (supabase && typeof supabase.from === 'function') {
      const fromObj = supabase.from('datos_maestros');
      if (fromObj && typeof fromObj.insert === 'function') {
        const { error } = await fromObj.insert({
          tipo: 'AUDITORIA_ACCION',
          valor: JSON.stringify(record),
          orden: Date.now() % 1000000000
        });

        if (error) {
          // Log suave para no interrumpir
        }
      }
    }
  } catch (err) {
    // Excepción silenciada
  }

  return record;
}

/**
 * Consulta el historial de acciones con filtros y paginación.
 */
export async function getHistorialAcciones({ limit = 150, modulo, lote, search } = {}) {
  let logs = [];

  // 1. Intentar cargar desde Supabase
  try {
    let query = supabase
      .from('datos_maestros')
      .select('id, tipo, valor, orden')
      .eq('tipo', 'AUDITORIA_ACCION')
      .order('id', { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      logs = data.map(d => {
        try {
          const parsed = typeof d.valor === 'string' ? JSON.parse(d.valor) : d.valor;
          return { ...parsed, db_id: d.id };
        } catch {
          return null;
        }
      }).filter(Boolean);
    }
  } catch (e) {
    console.warn('Error leyendo logs de Supabase, usando caché local:', e);
  }

  // 2. Si Supabase viene vacío o falló, mezclar con caché local o memoria (depurando casos de prueba)
  const fallbackList = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const local = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '[]');
      if (Array.isArray(local)) {
        // Eliminar permanentemente logs de prueba de la caché del navegador
        const cleaned = local.filter(l => !isTestAuditLog(l));
        if (cleaned.length !== local.length) {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(cleaned));
        }
        fallbackList.push(...cleaned);
      }
    } catch {
      // ignore
    }
  }

  // Depurar logs de prueba en memoria
  inMemoryLogs = inMemoryLogs.filter(l => !isTestAuditLog(l));
  fallbackList.push(...inMemoryLogs);

  if (fallbackList.length > 0) {
    const existingIds = new Set(logs.map(l => l.id));
    for (const item of fallbackList) {
      if (!existingIds.has(item.id) && !isTestAuditLog(item)) {
        logs.push(item);
      }
    }
  }

  // Filtrar de forma estricta cualquier log residual de prueba
  logs = logs.filter(l => !isTestAuditLog(l));

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
