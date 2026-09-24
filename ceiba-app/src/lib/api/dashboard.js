import { supabase } from '../supabase';
import { getSharedFinancialStats } from './financialStats';

export const getDashboardKpis = async () => {
  // ── 1. Estadísticas compartidas centralizadas (Fuente única de verdad) ────
  const shared = await getSharedFinancialStats();

  // ── 2. Ventas por mes (últimos 6 meses) ──────────────────────────────────
  const { data: ventasData } = await supabase
    .from('ventas')
    .select('precio_venta, fecha_venta, vendedor_nombre');

  const hace6meses = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const ventasMes = (ventasData || []).filter(v => v.fecha_venta && v.fecha_venta >= hace6meses);

  const meses = {};
  ventasMes.forEach(v => {
    const mes = v.fecha_venta.slice(0, 7);
    meses[mes] = (meses[mes] || 0) + (v.precio_venta || 0);
  });

  // ── 3. Ventas por vendedor ────────────────────────────────────────────────
  const vendedorMap = {};
  (ventasData || []).forEach(v => {
    if (!v.vendedor_nombre) return;
    if (!vendedorMap[v.vendedor_nombre]) vendedorMap[v.vendedor_nombre] = { ventas: 0, valor: 0 };
    vendedorMap[v.vendedor_nombre].ventas++;
    vendedorMap[v.vendedor_nombre].valor += (v.precio_venta || 0);
  });

  const ventasPorVendedor = Object.entries(vendedorMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, 6);

  // ── 4. Meses labels ───────────────────────────────────────────────────────
  const mesLabels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const sortedMeses = Object.entries(meses).sort(([a], [b]) => a.localeCompare(b));
  const ingresosMes = {
    labels:     sortedMeses.map(([k]) => mesLabels[parseInt(k.slice(5, 7)) - 1]),
    recaudado:  sortedMeses.map(([, v]) => v),
    proyectado: sortedMeses.map(() =>
      sortedMeses.length > 0 ? shared.totalProyectado / sortedMeses.length : 0
    ),
  };

  return {
    ...shared,
    ingresosMes,
    ventasPorVendedor,
  };
};

