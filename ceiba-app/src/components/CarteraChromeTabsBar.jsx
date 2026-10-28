import React, { useState, useRef, useEffect } from 'react';
import { 
  Table, Plus, X, Search, ChevronRight, Check,
  AlertTriangle, DollarSign, Clock, ShieldAlert,
  Home, Phone, User, CheckCircle2, XCircle,
  Columns, Grid, Maximize2, LayoutGrid, FileText
} from 'lucide-react';
import { formatCOP } from '../utils/helpers';

/**
 * Normaliza cadenas de búsqueda para comparar lotes independientemente
 * de si tienen espacios dobles, guiones o variaciones tipográficas.
 * Ej: "LC1 - 5 - 3" -> "lc153", "LC1  - 5 - 3" -> "lc153"
 */
function normalizeLoteCode(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '');
}

/**
 * Componente de barra de pestañas estilo Google Chrome para Gestión de Cartera y Control de Mora.
 * Permite abrir múltiples lotes/contratos simultáneamente, alternar entre ellos al instante,
 * dividirlos en pantalla lado a lado (2 clientes) o en mosaico (3 o 4 a la vez).
 */
export default function CarteraChromeTabsBar({
  activeTabId,
  openLoteIds = [],
  allCartera = [],
  onSelectTab,
  onCloseTab,
  onOpenLote,
  onCloseAll,
  viewMode = 'tabs',
  onChangeViewMode,
}) {
  const [modalSearchOpen, setModalSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('todos'); // 'todos' | 'mora' | 'criticos' | 'aldia'
  const searchInputRef = useRef(null);
  const tabsContainerRef = useRef(null);

  // Cerrar modal al presionar Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && modalSearchOpen) {
        setModalSearchOpen(false);
      }
    }
    if (modalSearchOpen) {
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalSearchOpen]);

  // Desplazar automáticamente al tab activo cuando cambia
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeEl = tabsContainerRef.current.querySelector('.cartera-tab-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId]);

  // Filtrar lista de lotes para el buscador inteligente
  const filteredLotes = allCartera.filter(v => {
    const rawSearch = searchQuery.trim();
    if (!rawSearch) {
      // Si no hay búsqueda, aplicar solo filtro de tipo
      if (filterType === 'mora') return (Number(v.cuotas_vencidas) || 0) > 0;
      if (filterType === 'criticos') return Boolean(v.es_critico);
      if (filterType === 'aldia') return (Number(v.cuotas_vencidas) || 0) === 0 && (Number(v.saldo) || 0) > 0;
      return true;
    }

    const sNorm = normalizeLoteCode(rawSearch);
    const sLower = rawSearch.toLowerCase();

    const loteRaw = v.id_lote || v.lotes?.id_lote || '';
    const loteNorm = normalizeLoteCode(loteRaw);
    const clienteStr = (v.cliente_nombre || v.clientes?.nombre || '').toLowerCase();
    const docStr = String(v.clientes?.doc_cliente || v.doc_cliente || '').toLowerCase();
    const celStr = String(v.clientes?.celular || v.celular || '');

    // Coincidencia inteligente: normalizado de lote (ej: lc153 coincide con LC1  - 5 - 3), cliente, cédula o celular
    const matchesLote = loteNorm.includes(sNorm) || loteRaw.toLowerCase().includes(sLower);
    const matchesCliente = clienteStr.includes(sLower);
    const matchesDoc = docStr.includes(sLower);
    const matchesCel = celStr.includes(sLower);

    const matchesSearch = matchesLote || matchesCliente || matchesDoc || matchesCel;
    if (!matchesSearch) return false;

    if (filterType === 'mora') return (Number(v.cuotas_vencidas) || 0) > 0;
    if (filterType === 'criticos') return Boolean(v.es_critico);
    if (filterType === 'aldia') return (Number(v.cuotas_vencidas) || 0) === 0 && (Number(v.saldo) || 0) > 0;

    return true;
  }).slice(0, 40);

  return (
    <div style={{ position: 'relative', marginBottom: 18, zIndex: 10 }}>
      {/* ── BARRA DE PESTAÑAS PRINCIPAL ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#e2e8f0',
          borderRadius: '12px 12px 0 0',
          border: '1px solid #cbd5e1',
          borderBottom: '2px solid #0f766e',
          padding: '6px 8px 0 8px',
          gap: 6,
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        }}
      >
        {/* Strip horizontal con scroll para pestañas */}
        <div
          ref={tabsContainerRef}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 4,
            overflowX: 'auto',
            scrollbarWidth: 'thin',
            flex: 1,
            paddingBottom: 0,
          }}
          className="cartera-tabs-strip"
        >
          {/* PESTAÑA FIJA: CONTROL DE MORA & CARTERA */}
          <div
            onClick={() => onSelectTab('general')}
            className={activeTabId === 'general' ? 'cartera-tab-active' : 'cartera-tab-inactive'}
            title="Vista consolidada: Matriz de cartera general, verificación lote por lote y recaudos"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTabId === 'general' ? 800 : 600,
              color: activeTabId === 'general' ? '#0f172a' : '#475569',
              background: activeTabId === 'general' ? '#ffffff' : '#f1f5f9',
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              borderTop: activeTabId === 'general' ? '3px solid #0f766e' : '3px solid transparent',
              borderLeft: activeTabId === 'general' ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
              borderRight: activeTabId === 'general' ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
              borderBottom: activeTabId === 'general' ? '2px solid #ffffff' : 'none',
              marginBottom: activeTabId === 'general' ? -2 : 0,
              boxShadow: activeTabId === 'general' ? '0 -2px 6px rgba(0,0,0,0.06)' : 'none',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'all 0.15s ease-in-out',
              zIndex: activeTabId === 'general' ? 3 : 1,
              flexShrink: 0,
            }}
          >
            <Table size={15} color={activeTabId === 'general' ? '#0f766e' : '#64748b'} />
            <span>Control de Mora & Cartera</span>
            <span
              style={{
                fontSize: 11,
                padding: '1px 8px',
                borderRadius: 12,
                background: activeTabId === 'general' ? '#ccfbf1' : '#e2e8f0',
                color: activeTabId === 'general' ? '#0f766e' : '#475569',
                fontWeight: 800,
              }}
            >
              {allCartera.length}
            </span>
          </div>

          {/* PESTAÑAS DINÁMICAS DE LOTES ABIERTOS */}
          {openLoteIds.map((loteId) => {
            const isActive = activeTabId === loteId;
            const venta = allCartera.find(v => (v.id || v.venta_id) === loteId);
            const loteStr = venta?.id_lote || venta?.lotes?.id_lote || 'Lote';
            const clienteStr = venta?.cliente_nombre || venta?.clientes?.nombre || 'Cliente';
            const cuotasVencidas = Number(venta?.cuotas_vencidas || 0);
            const saldo = Number(venta?.saldo || 0);
            const isMora = cuotasVencidas > 0 || venta?.es_critico;
            const isSaldado = saldo <= 0 || venta?.estado === 'PAGADO EN SU TOTALIDAD' || venta?.estado === 'PAGADO';

            // Micro badges distintivos
            let dotColor = '#3b82f6';
            let badgeBg = '#eff6ff';
            let badgeBorder = '#bfdbfe';
            let badgeColor = '#1d4ed8';
            let badgeText = 'Al Día';

            if (isMora) {
              dotColor = '#dc2626';
              badgeBg = '#fee2e2';
              badgeBorder = '#fca5a5';
              badgeColor = '#dc2626';
              badgeText = cuotasVencidas > 0 ? `${cuotasVencidas} Mora` : 'En Mora';
            } else if (isSaldado) {
              dotColor = '#16a34a';
              badgeBg = '#dcfce7';
              badgeBorder = '#86efac';
              badgeColor = '#15803d';
              badgeText = 'Saldado';
            }

            return (
              <div
                key={loteId}
                onClick={() => onSelectTab(loteId)}
                className={isActive ? 'cartera-tab-active' : 'cartera-tab-inactive'}
                title={`${loteStr} — ${clienteStr} · Saldo: ${formatCOP(saldo)}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px 9px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#0f172a' : '#334155',
                  background: isActive ? '#ffffff' : '#f1f5f9',
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  borderTop: isActive ? '3px solid #0f766e' : '3px solid transparent',
                  borderLeft: isActive ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                  borderRight: isActive ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                  borderBottom: isActive ? '2px solid #ffffff' : 'none',
                  marginBottom: isActive ? -2 : 0,
                  boxShadow: isActive ? '0 -2px 6px rgba(0,0,0,0.06)' : 'none',
                  maxWidth: 260,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'all 0.15s ease-in-out',
                  zIndex: isActive ? 3 : 1,
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {/* Punto indicador */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: dotColor,
                    flexShrink: 0,
                    boxShadow: `0 0 0 2px ${dotColor}33`,
                  }}
                />

                {/* Código del Lote */}
                <span style={{ fontWeight: 900, color: isActive ? '#0f766e' : '#1e293b', flexShrink: 0 }}>
                  {loteStr}
                </span>

                {/* Nombre de cliente recortado */}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 110,
                    fontSize: 12,
                    color: isActive ? '#475569' : '#64748b',
                  }}
                >
                  {clienteStr}
                </span>

                {/* Badge de estado */}
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 6,
                    background: badgeBg,
                    border: `1px solid ${badgeBorder}`,
                    color: badgeColor,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {badgeText}
                </span>

                {/* Botón cerrar pestaña '×' */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(loteId, e);
                  }}
                  title={`Cerrar pestaña de ${loteStr}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    marginLeft: 2,
                    padding: 0,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>
            );
          })}

          {/* BOTÓN NUEVA PESTAÑA: '+ Buscar otro Lote' */}
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 5, paddingLeft: 4 }}>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterType('todos');
                setModalSearchOpen(true);
              }}
              title="Buscar y abrir otro lote o deudor en una nueva pestaña"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 29,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid #0f766e',
                background: '#0f766e',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: '0 1px 3px rgba(15, 118, 110, 0.3)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#115e59';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#0f766e';
              }}
            >
              <Plus size={14} strokeWidth={3} />
              <span>Buscar otro Lote</span>
            </button>
          </div>
        </div>

        {/* CONTROLES MULTI-LOTE A LA DERECHA (CUANDO HAY >= 2 PESTAÑAS ABIERTAS) */}
        {openLoteIds.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 5, flexShrink: 0 }}>
            {/* Selector de modo de vista: 1 Cliente | Dividir 2 | Mosaico */}
            {onChangeViewMode && (
              <div
                style={{
                  display: 'inline-flex',
                  background: '#f1f5f9',
                  padding: '2px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                }}
              >
                <button
                  type="button"
                  onClick={() => onChangeViewMode('tabs')}
                  title="Ver 1 cliente en pantalla completa enfocada"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: viewMode === 'tabs' ? 800 : 600,
                    border: 'none',
                    background: viewMode === 'tabs' ? '#ffffff' : 'transparent',
                    color: viewMode === 'tabs' ? '#0f766e' : '#475569',
                    boxShadow: viewMode === 'tabs' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Maximize2 size={11} />
                  <span>1 Cliente</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeViewMode('split2')}
                  title="Dividir pantalla: Ver 2 clientes lado a lado en paralelo"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: viewMode === 'split2' ? 800 : 600,
                    border: 'none',
                    background: viewMode === 'split2' ? '#ffffff' : 'transparent',
                    color: viewMode === 'split2' ? '#0f766e' : '#475569',
                    boxShadow: viewMode === 'split2' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Columns size={11} />
                  <span>Dividir 2</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeViewMode('grid')}
                  title="Ver cuadrícula/mosaico con hasta 4 clientes abiertos simultáneamente"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: viewMode === 'grid' ? 800 : 600,
                    border: 'none',
                    background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                    color: viewMode === 'grid' ? '#0f766e' : '#475569',
                    boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <LayoutGrid size={11} />
                  <span>Mosaico ({Math.min(4, openLoteIds.length)})</span>
                </button>
              </div>
            )}

            {/* Botón cerrar todas las pestañas */}
            <button
              type="button"
              onClick={onCloseAll}
              title="Cerrar todas las pestañas de lotes abiertas y volver a la vista general"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 9px',
                borderRadius: 5,
                border: '1px solid #fca5a5',
                background: '#fff1f2',
                color: '#dc2626',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fee2e2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff1f2';
              }}
            >
              <XCircle size={13} />
              <span>Cerrar pestañas ({openLoteIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL FLOTANTE / DIÁLOGO DE BÚSQUEDA RÁPIDA (Spotlight) ── */}
      {/* Está fuera del strip de scroll para que NUNCA sufra cortes ni desbordes */}
      {modalSearchOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '80px',
            paddingLeft: '16px',
            paddingRight: '16px',
          }}
          onClick={() => setModalSearchOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 580,
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
            }}
          >
            {/* Header del buscador con input principal */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  <Home size={18} color="#0f766e" />
                  <span>Abrir Lote en Nueva Pestaña</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalSearchOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Input de búsqueda estilizado con lupa */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={18} style={{ position: 'absolute', left: 14, color: '#0f766e' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Escribe el lote (ej: LC1 5 3, 5-3), titular o cédula..."
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 44px',
                    borderRadius: 8,
                    border: '2px solid #0f766e',
                    fontSize: 14,
                    fontWeight: 500,
                    outline: 'none',
                    background: '#ffffff',
                    color: '#0f172a',
                    boxShadow: '0 0 0 3px rgba(15, 118, 110, 0.15)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredLotes.length > 0) {
                      onOpenLote(filteredLotes[0]);
                      setModalSearchOpen(false);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 12,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: 2,
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Filtros rápidos: Todos, En Mora, Críticos, Al Día */}
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {[
                  { id: 'todos', label: 'Todos los Lotes' },
                  { id: 'mora', label: '🔴 En Mora' },
                  { id: 'criticos', label: '🚨 Críticos (>180d)' },
                  { id: 'aldia', label: '🔵 Al Día' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterType(f.id)}
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: filterType === f.id ? '1px solid #0f766e' : '1px solid #cbd5e1',
                      background: filterType === f.id ? '#ccfbf1' : '#ffffff',
                      color: filterType === f.id ? '#0f766e' : '#475569',
                      fontWeight: filterType === f.id ? 800 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de resultados scrolleable */}
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: 380, padding: '6px 0' }}>
              {filteredLotes.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                  <Search size={32} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                    No se encontraron contratos con "{searchQuery}"
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    Prueba buscando solo el número de manzana y lote (ej: "5 3" o "5-3") o el nombre del cliente.
                  </div>
                </div>
              ) : (
                filteredLotes.map((v) => {
                  const targetId = v.id || v.venta_id;
                  const isOpen = openLoteIds.includes(targetId);
                  const lStr = v.id_lote || v.lotes?.id_lote || 'Lote';
                  const cStr = v.cliente_nombre || v.clientes?.nombre || 'Cliente sin nombre';
                  const docStr = v.clientes?.doc_cliente || v.doc_cliente || '';
                  const cuotasVenc = Number(v.cuotas_vencidas || 0);
                  const saldo = Number(v.saldo || 0);
                  const isMora = cuotasVenc > 0 || v.es_critico;
                  const isSaldado = saldo <= 0 || v.estado === 'PAGADO EN SU TOTALIDAD' || v.estado === 'PAGADO';

                  return (
                    <div
                      key={targetId}
                      onClick={() => {
                        onOpenLote(v);
                        setModalSearchOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '11px 20px',
                        cursor: 'pointer',
                        background: isOpen ? '#f0fdf4' : 'transparent',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.12s ease-in-out',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isOpen ? '#dcfce7' : '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isOpen ? '#f0fdf4' : 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden', paddingRight: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: '#0f766e' }}>
                            {lStr}
                          </span>
                          {isMora ? (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: '#fee2e2', color: '#dc2626', fontWeight: 800, border: '1px solid #fca5a5' }}>
                              🔴 {cuotasVenc} Cuotas Mora
                            </span>
                          ) : isSaldado ? (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: '#dcfce7', color: '#15803d', fontWeight: 800, border: '1px solid #86efac' }}>
                              🟢 Saldado
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: '#eff6ff', color: '#1d4ed8', fontWeight: 800, border: '1px solid #bfdbfe' }}>
                              🔵 Al Día
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cStr}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {docStr && `CC: ${docStr} · `}Saldo pendiente: <strong style={{ color: isMora ? '#dc2626' : '#0f766e' }}>{formatCOP(saldo)}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {isOpen ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: '#15803d',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#dcfce7',
                              padding: '3px 8px',
                              borderRadius: 5,
                              border: '1px solid #86efac',
                            }}
                          >
                            <Check size={12} strokeWidth={3} /> Abierto
                          </span>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#0f766e',
                              background: '#f0fdfa',
                              padding: '4px 9px',
                              borderRadius: 6,
                              border: '1px solid #ccfbf1',
                            }}
                          >
                            <span>Abrir pestaña</span>
                            <ChevronRight size={14} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer con ayuda y atajo */}
            <div style={{ padding: '9px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#64748b' }}>
              <span>Presiona <strong>Enter</strong> para abrir el primer resultado</span>
              <span><strong>Esc</strong> para cerrar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
