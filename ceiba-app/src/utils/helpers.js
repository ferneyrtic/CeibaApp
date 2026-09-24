/**
 * Formatea un número como pesos colombianos (COP)
 */
export const formatCOP = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

/**
 * Formatea un número con separadores de miles
 */
export const formatNumber = (value) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CO').format(value);
};

/**
 * Formatea una fecha (string ISO o Date) como DD/MM/YYYY
 */
export const formatDate = (value) => {
  if (!value || value === 'None' || value === 'nan') return '—';
  try {
    const d = new Date(value + (String(value).length === 10 ? 'T12:00:00' : ''));
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch { return '—'; }
};

/**
 * Devuelve el color y etiqueta de badge para un estado de lote
 */
export const getEstadoBadge = (estado) => {
  const map = {
    'VENDIDO':                { color:'#16a34a', bg:'#dcfce7', label:'Vendido' },
    'PAGADO EN SU TOTALIDAD': { color:'#059669', bg:'#d1fae5', label:'Pagado en su totalidad' },
    'PAGADO':                 { color:'#059669', bg:'#d1fae5', label:'Pagado en su totalidad' },
    'SALDADO':                { color:'#059669', bg:'#d1fae5', label:'Pagado en su totalidad' },
    'DISPONIBLE':             { color:'#2563eb', bg:'#dbeafe', label:'Disponible' },
    'EN NEGOCIACIÓN':         { color:'#d97706', bg:'#fef3c7', label:'En Negociación' },
    'APARTADO':               { color:'#7c3aed', bg:'#ede9fe', label:'Apartado' },
    'NO APTO PARA VENTA':     { color:'#dc2626', bg:'#fee2e2', label:'No Apto' },
  };
  return map[estado] || { color:'#6b7280', bg:'#f3f4f6', label: estado || 'Sin estado' };
};


/**
 * Devuelve el color y etiqueta para el estado de una cuota
 */
export const getEstadoCuotaBadge = (estado) => {
  const map = {
    'PAGA':        { color:'#16a34a', bg:'#dcfce7', label:'Paga' },
    'AL DÍA':      { color:'#2563eb', bg:'#dbeafe', label:'Al Día' },
    'POR VENCER':  { color:'#d97706', bg:'#fef3c7', label:'Por Vencer' },
    'VENCIDA':     { color:'#dc2626', bg:'#fee2e2', label:'Vencida' },
  };
  return map[estado] || { color:'#6b7280', bg:'#f3f4f6', label: estado || '—' };
};

/**
 * Calcula los días de diferencia entre hoy y una fecha
 * Negativo = vencida, Positivo = faltan días
 */
export const diasDesdeHoy = (fecha) => {
  if (!fecha) return null;
  const hoy  = new Date();
  hoy.setHours(0,0,0,0);
  const d    = new Date(fecha + 'T12:00:00');
  return Math.round((d - hoy) / (1000 * 60 * 60 * 24));
};
