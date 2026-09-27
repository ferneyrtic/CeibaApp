import { useState, useMemo, useCallback, useEffect } from 'react';
import { getCartera, getCarteraStats, clearCarteraCache } from '../lib/api/cartera';
import { getCasosEspeciales, obtenerBadgeCasoEspecial } from '../lib/api/casosEspecialesApi';
import { formatDate } from '../utils/helpers';

export const FILTROS_CARTERA = [
  'Todos',
  'Con Saldo',
  'En Mora',
  'Pagado',
  'Sin Gestión',
  '🚨 Casos Críticos (>180 días)',
  '📌 Casos Especiales'
];

/**
 * Custom Hook para desacoplar la lógica de estado, búsqueda, filtrado y paginación de Cartera (SRP)
 */
export function useCarteraLogic() {
  const [allCartera, setAllCartera] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const [casosEspeciales, setCasosEspeciales] = useState([]);

  // Paginación principal
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Vistas y filtros de Verificación
  const [vistaModo, setVistaModo] = useState('general');
  const [filtroVerif, setFiltroVerif] = useState('Todos');
  const [pageVerif, setPageVerif] = useState(1);
  const [pageSizeVerif, setPageSizeVerif] = useState(50);

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (force) clearCarteraCache();
      const [carteraData, statsData, casosData] = await Promise.all([
        getCartera({ forceRefresh: force }),
        getCarteraStats(force),
        getCasosEspeciales().catch(() => [])
      ]);
      setAllCartera(carteraData || []);
      setStats(statsData);
      setCasosEspeciales(casosData || []);
    } catch (err) {
      console.error('Error cargando cartera en useCarteraLogic:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const casosEspecialesActivosCount = useMemo(() => {
    return (casosEspeciales || []).filter(c => c.estado !== 'RESUELTO').length;
  }, [casosEspeciales]);

  // Cartera Filtrada (con id_lote, clientes, celular, documento)
  const filteredCartera = useMemo(() => {
    let result = allCartera;

    if (filtro && filtro !== 'Todos') {
      if (filtro === 'Con Saldo') {
        result = result.filter(v => (v.saldo || 0) > 0 && v.estado === 'VENDIDO');
      } else if (filtro === 'Pagado') {
        result = result.filter(v => (v.saldo || 0) <= 0 && v.estado === 'VENDIDO');
      } else if (filtro === 'En Mora') {
        result = result.filter(v => (v.cuotas_vencidas || 0) > 0);
      } else if (filtro === 'Sin Gestión') {
        result = result.filter(v => !v.fecha_venta && (v.saldo || 0) > 0);
      } else if (filtro === '🚨 Casos Críticos (>180 días)' || filtro === 'Casos Críticos') {
        result = result.filter(v => v.es_critico && (v.saldo || 0) > 0);
      } else if (filtro === '📌 Casos Especiales') {
        result = result.filter(v => Boolean(obtenerBadgeCasoEspecial(v.id_lote || v.lotes?.id_lote, casosEspeciales)));
      }
    }

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      result = result.filter(v =>
        (v.id_lote && v.id_lote.toLowerCase().includes(s)) ||
        (v.lotes?.id_lote && v.lotes.id_lote.toLowerCase().includes(s)) ||
        (v.cliente_nombre && v.cliente_nombre.toLowerCase().includes(s)) ||
        (v.clientes?.nombre && v.clientes.nombre.toLowerCase().includes(s)) ||
        (v.vendedor_nombre && v.vendedor_nombre.toLowerCase().includes(s)) ||
        (v.clientes?.doc_cliente && String(v.clientes.doc_cliente).toLowerCase().includes(s)) ||
        (v.clientes?.celular && String(v.clientes.celular).includes(s))
      );
    }

    return result;
  }, [allCartera, filtro, search, casosEspeciales]);

  // Paginación de Cartera
  const paginatedCartera = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCartera.slice(start, start + pageSize);
  }, [filteredCartera, page, pageSize]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
    setPageVerif(1);
  };

  const handleFiltroChange = (e) => {
    setFiltro(e.target.value);
    setPage(1);
  };

  // ── Módulo de Verificación Lote por Lote (Al Día / En Mora) ──────────────
  const alDiaCount    = useMemo(() => allCartera.filter(v => v.estado === 'VENDIDO' && (v.cuotas_vencidas || 0) === 0 && (v.saldo || 0) > 0).length, [allCartera]);
  const moraCount     = useMemo(() => allCartera.filter(v => v.estado === 'VENDIDO' && (v.cuotas_vencidas || 0) > 0).length, [allCartera]);
  const saldadosCount = useMemo(() => allCartera.filter(v => v.estado === 'VENDIDO' && (v.saldo || 0) <= 0).length, [allCartera]);
  const criticosCount = useMemo(() => allCartera.filter(v => v.estado === 'VENDIDO' && (v.cuotas_vencidas || 0) >= 3).length, [allCartera]);

  const verificacionCartera = useMemo(() => {
    let list = allCartera.filter(v => v.estado === 'VENDIDO');

    if (filtroVerif === 'Al Día') {
      list = list.filter(v => (v.cuotas_vencidas || 0) === 0 && (v.saldo || 0) > 0);
    } else if (filtroVerif === 'En Mora') {
      list = list.filter(v => (v.cuotas_vencidas || 0) > 0);
    } else if (filtroVerif === 'Críticos') {
      list = list.filter(v => (v.cuotas_vencidas || 0) >= 3);
    } else if (filtroVerif === 'Saldados') {
      list = list.filter(v => (v.saldo || 0) <= 0);
    }

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      list = list.filter(v =>
        (v.id_lote && v.id_lote.toLowerCase().includes(s)) ||
        (v.lotes?.id_lote && v.lotes.id_lote.toLowerCase().includes(s)) ||
        (v.cliente_nombre && v.cliente_nombre.toLowerCase().includes(s)) ||
        (v.clientes?.nombre && v.clientes.nombre.toLowerCase().includes(s)) ||
        (v.vendedor_nombre && v.vendedor_nombre.toLowerCase().includes(s)) ||
        (v.clientes?.doc_cliente && String(v.clientes.doc_cliente).toLowerCase().includes(s)) ||
        (v.clientes?.celular && String(v.clientes.celular).includes(s))
      );
    }

    return list;
  }, [allCartera, filtroVerif, search]);

  const paginatedVerif = useMemo(() => {
    const start = (pageVerif - 1) * pageSizeVerif;
    return verificacionCartera.slice(start, start + pageSizeVerif);
  }, [verificacionCartera, pageVerif, pageSizeVerif]);

  const totalSaldoVisible = useMemo(() => {
    return filteredCartera.reduce((a, v) => a + (Number(v.saldo) || 0), 0);
  }, [filteredCartera]);

  const exportarVerificacionExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const rows = verificacionCartera.map((v, idx) => ({
      '#': idx + 1,
      'ID LOTE': v.id_lote || v.lotes?.id_lote || '',
      'CLIENTE': v.cliente_nombre || v.clientes?.nombre || '',
      'DOCUMENTO': v.clientes?.doc_cliente || '',
      'TELÉFONO': v.clientes?.celular || '',
      'DIAGNÓSTICO': (v.saldo || 0) <= 0 ? 'SALDADO / PAZ Y SALVO' : ((v.cuotas_vencidas || 0) > 0 ? `DEBE ${v.cuotas_vencidas} CUOTAS` : 'AL DÍA'),
      'CUOTAS VENCIDAS': v.cuotas_vencidas || 0,
      'VALOR EN MORA ESTIMADO': (v.cuotas_vencidas || 0) * (v.valor_cuota || 0),
      'CUOTAS PAGADAS': v.cuotas_pagadas_count || 0,
      'PLAZO CUOTAS': v.plazo_cuotas || 0,
      'VALOR CUOTA': v.valor_cuota || 0,
      'TOTAL PAGADO': v.total_pagado || 0,
      'SALDO RESTANTE': v.saldo || 0,
      'ASESOR COMERCIAL': v.vendedor_nombre || '',
      'FECHA VENTA': v.fecha_venta ? formatDate(v.fecha_venta) : ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Verificación Lote a Lote');
    XLSX.writeFile(wb, `Verificacion_Lote_por_Lote_LaCeiba_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return {
    allCartera,
    filteredCartera,
    paginatedCartera,
    stats,
    loading,
    search,
    setSearch,
    handleSearchChange,
    filtro,
    setFiltro,
    handleFiltroChange,
    casosEspeciales,
    casosEspecialesActivosCount,
    page,
    setPage,
    pageSize,
    setPageSize,
    vistaModo,
    setVistaModo,
    filtroVerif,
    setFiltroVerif,
    pageVerif,
    setPageVerif,
    pageSizeVerif,
    setPageSizeVerif,
    alDiaCount,
    moraCount,
    saldadosCount,
    criticosCount,
    verificacionCartera,
    paginatedVerif,
    totalSaldoVisible,
    exportarVerificacionExcel,
    loadData
  };
}
