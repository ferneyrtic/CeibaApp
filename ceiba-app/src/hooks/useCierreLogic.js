import { useState, useMemo, useCallback, useEffect } from 'react';
import { getCierreMensualData, clearCierreCache } from '../lib/api/cierreApi';

/**
 * Custom Hook para Cierre Mensual (Separation of Concerns & SRP)
 */
export function useCierreLogic() {
  const today = new Date();
  const defaultDesde = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultHasta = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [fechaDesde, setFechaDesde]     = useState(defaultDesde);
  const [fechaHasta, setFechaHasta]     = useState(defaultHasta);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [data, setData]                 = useState(null);
  const [exporting, setExporting]       = useState(false);

  // Pestañas y filtros
  const [activeTab, setActiveTab]       = useState('todos');
  const [searchTerm, setSearchTerm]     = useState('');
  const [medioFilter, setMedioFilter]   = useState('TODOS');
  const [asesorFilter, setAsesorFilter] = useState('TODOS');

  // Paginación
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(50);

  const periodoLabel = `${fechaDesde} al ${fechaHasta}`;

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (force) clearCierreCache();
      const res = await getCierreMensualData(fechaDesde, fechaHasta, force);
      setData(res);
      setPage(1);
    } catch (e) {
      console.error('Error cargando recaudos del periodo:', e);
      setError(e.message || 'Error cargando recaudos del periodo');
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lista base según la pestaña activa
  const listForTab = useMemo(() => {
    if (!data) return [];
    if (activeTab === 'cuotas') return data.cuotasMes || [];
    if (activeTab === 'iniciales') return data.inicialesMes || [];
    return data.todosIngresos || [];
  }, [data, activeTab]);

  // Filtrar según búsqueda y selectores
  const filteredItems = useMemo(() => {
    return listForTab.filter(item => {
      if (medioFilter !== 'TODOS' && item.medio_pago?.toUpperCase() !== medioFilter.toUpperCase()) {
        return false;
      }
      if (asesorFilter !== 'TODOS' && item.vendedor !== asesorFilter) {
        return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const m1 = item.lote?.toLowerCase().includes(s);
        const m2 = item.cliente?.toLowerCase().includes(s);
        const m3 = item.doc_cliente?.toLowerCase().includes(s);
        const m4 = item.concepto?.toLowerCase().includes(s);
        const m5 = item.vendedor?.toLowerCase().includes(s);
        return m1 || m2 || m3 || m4 || m5;
      }
      return true;
    });
  }, [listForTab, searchTerm, medioFilter, asesorFilter]);

  // Paginación de Ingresos
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // Suma total de los items filtrados
  const totalFiltrado = useMemo(() => {
    return filteredItems.reduce((acc, it) => acc + (it.valor || 0), 0);
  }, [filteredItems]);

  // Filtrado de Comisiones Desembolsadas
  const filteredComisiones = useMemo(() => {
    if (!data?.comisionesPeriodo) return [];
    return data.comisionesPeriodo.filter(item => {
      if (medioFilter !== 'TODOS' && item.medio_pago?.toUpperCase() !== medioFilter.toUpperCase()) {
        return false;
      }
      if (asesorFilter !== 'TODOS' && item.vendedor !== asesorFilter) {
        return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const m1 = item.lote?.toLowerCase().includes(s);
        const m2 = item.vendedor?.toLowerCase().includes(s);
        const m3 = item.comprobante?.toLowerCase().includes(s);
        const m4 = item.observacion?.toLowerCase().includes(s);
        return m1 || m2 || m3 || m4;
      }
      return true;
    });
  }, [data?.comisionesPeriodo, searchTerm, medioFilter, asesorFilter]);

  const totalComisionesItems = filteredComisiones.length;
  const totalPagesComisiones = Math.max(1, Math.ceil(totalComisionesItems / pageSize));
  const paginatedComisiones = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredComisiones.slice(start, start + pageSize);
  }, [filteredComisiones, page, pageSize]);

  const totalFiltradoComisiones = useMemo(() => {
    return filteredComisiones.reduce((acc, it) => acc + (it.valor || 0), 0);
  }, [filteredComisiones]);

  // Lista de asesores y medios para filtros rápidos
  const asesoresDisponibles = useMemo(() => {
    if (!data) return [];
    const list = [
      ...(data.todosIngresos || []).map(i => i.vendedor),
      ...(data.comisionesPeriodo || []).map(c => c.vendedor)
    ].filter(Boolean);
    return [...new Set(list)].sort();
  }, [data]);

  const mediosDisponibles = useMemo(() => {
    if (!data) return [];
    const list = [
      ...(data.todosIngresos || []).map(i => (i.medio_pago || 'Transferencia').toUpperCase()),
      ...(data.comisionesPeriodo || []).map(c => (c.medio_pago || 'Transferencia').toUpperCase())
    ].filter(Boolean);
    return [...new Set(list)].sort();
  }, [data]);

  return {
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    loading,
    error,
    data,
    exporting,
    setExporting,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    medioFilter,
    setMedioFilter,
    asesorFilter,
    setAsesorFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    periodoLabel,
    loadData,
    listForTab,
    filteredItems,
    totalItems,
    totalPages,
    paginatedItems,
    totalFiltrado,
    filteredComisiones,
    totalComisionesItems,
    totalPagesComisiones,
    paginatedComisiones,
    totalFiltradoComisiones,
    asesoresDisponibles,
    mediosDisponibles
  };
}
