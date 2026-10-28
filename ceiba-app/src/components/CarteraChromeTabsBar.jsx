import React, { useState, useRef, useEffect } from 'react';
import { 
  Table, Plus, X, Search, ChevronRight, Check,
  AlertTriangle, DollarSign, Clock, ShieldAlert,
  Home, Phone, User, CheckCircle2, XCircle,
  Columns, Grid, Maximize2, LayoutGrid
} from 'lucide-react';
import { formatCOP } from '../utils/helpers';

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [filterType, setFilterType] = useState('todos'); // 'todos' | 'mora' | 'criticos' | 'aldia'
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const tabsContainerRef = useRef(null);

  // Cerrar dropdown al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  // Desplazar automáticamente al tab activo cuando cambia
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeEl = tabsContainerRef.current.querySelector('.cartera-tab-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId]);

  // Filtrar lista de lotes para el buscador rápido dropdown
  const filteredLotesDropdown = allCartera.filter(v => {
    const s = dropdownSearch.toLowerCase().trim();
    const loteStr = (v.id_lote || v.lotes?.id_lote || '').toLowerCase();
    const clienteStr = (v.cliente_nombre || v.clientes?.nombre || '').toLowerCase();
    const docStr = String(v.clientes?.doc_cliente || '').toLowerCase();
    const celStr = String(v.clientes?.celular || '');

    const matchesSearch = !s || loteStr.includes(s) || clienteStr.includes(s) || docStr.includes(s) || celStr.includes(s);
    if (!matchesSearch) return false;

    if (filterType === 'mora') {
      return (Number(v.cuotas_vencidas) || 0) > 0;
    }
    if (filterType === 'criticos') {
      return Boolean(v.es_critico);
    }
    if (filterType === 'aldia') {
      return (Number(v.cuotas_vencidas) || 0) === 0 && (Number(v.saldo) || 0) > 0;
    }
    return true;
  }).slice(0, 30); // Limitar a 30 resultados para máxima fluidez

  return (
    <div style={{ position: 'relative', marginBottom: 16, zIndex: 20 }}>
      {/* Contenedor principal de pestañas estilo Chrome */}
      <div
        ref={tabsContainerRef}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          background: 'var(--bg-card2, #f1f5f9)',
          padding: '8px 8px 0 8px',
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          border: '1px solid var(--border, #e2e8f0)',
          borderBottom: '2px solid #0f766e',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          gap: 3,
        }}
        className="cartera-tabs-strip"
      >
        {/* PESTAÑA FIJA: CARTERA & CONTROL DE MORA GENERAL */}
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
            fontWeight: activeTabId === 'general' ? 700 : 500,
            color: activeTabId === 'general' ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
            background: activeTabId === 'general' ? 'var(--bg-card, #ffffff)' : 'transparent',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            border: activeTabId === 'general' ? '1px solid var(--border, #cbd5e1)' : '1px solid transparent',
            borderBottom: activeTabId === 'general' ? '2px solid var(--bg-card, #ffffff)' : 'none',
            marginBottom: activeTabId === 'general' ? -2 : 0,
            boxShadow: activeTabId === 'general' ? '0 -2px 6px rgba(0,0,0,0.06)' : 'none',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            transition: 'background 0.15s, color 0.15s',
            zIndex: activeTabId === 'general' ? 2 : 1,
            flexShrink: 0,
          }}
        >
          <Table size={15} color={activeTabId === 'general' ? '#0f766e' : 'var(--text-muted, #94a3b8)'} />
          <span>Control de Mora & Cartera</span>
          <span style={{
            fontSize: 11,
            padding: '1px 7px',
            borderRadius: 10,
            background: activeTabId === 'general' ? '#ccfbf1' : '#e2e8f0',
            color: activeTabId === 'general' ? '#0f766e' : '#64748b',
            fontWeight: 800,
          }}>
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

          // Color del punto y micro-badge
          let dotColor = '#3b82f6';
          let badgeBg = '#eff6ff';
          let badgeColor = '#1d4ed8';
          let badgeText = 'Al Día';

          if (isMora) {
            dotColor = '#dc2626';
            badgeBg = '#fee2e2';
            badgeColor = '#dc2626';
            badgeText = `${cuotasVencidas} mora`;
          } else if (isSaldado) {
            dotColor = '#16a34a';
            badgeBg = '#dcfce7';
            badgeColor = '#15803d';
            badgeText = 'Saldado';
          }

          return (
            <div
              key={loteId}
              onClick={() => onSelectTab(loteId)}
              className={isActive ? 'cartera-tab-active' : 'cartera-tab-inactive'}
              title={`${loteStr} · ${clienteStr} · Saldo: ${formatCOP(saldo)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 12px 9px 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
                background: isActive ? 'var(--bg-card, #ffffff)' : 'transparent',
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                border: isActive ? '1px solid var(--border, #cbd5e1)' : '1px solid transparent',
                borderBottom: isActive ? '2px solid var(--bg-card, #ffffff)' : 'none',
                marginBottom: isActive ? -2 : 0,
                boxShadow: isActive ? '0 -2px 6px rgba(0,0,0,0.06)' : 'none',
                maxWidth: 240,
                whiteSpace: 'nowrap',
                userSelect: 'none',
                transition: 'background 0.15s, color 0.15s',
                zIndex: isActive ? 2 : 1,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {/* Indicador de estado */}
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dotColor,
                flexShrink: 0,
                boxShadow: `0 0 0 2px ${dotColor}33`,
              }} />

              {/* Identificador Lote */}
              <span style={{ fontWeight: 800, color: isActive ? '#0f766e' : 'inherit', flexShrink: 0 }}>
                {loteStr}
              </span>

              {/* Nombre cliente recortado */}
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 100,
                fontSize: 12,
                color: 'var(--text-muted, #64748b)',
              }}>
                {clienteStr}
              </span>

              {/* Micro-badge de estado */}
              <span style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 6,
                background: badgeBg,
                color: badgeColor,
                fontWeight: 800,
                flexShrink: 0,
              }}>
                {badgeText}
              </span>

              {/* Botón de cerrar pestaña '×' */}
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
                  color: 'var(--text-muted, #94a3b8)',
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
                  e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
                }}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}

        {/* BOTÓN NUEVA PESTAÑA: '+ Buscar otro Lote' */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', paddingBottom: 6 }}>
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setDropdownSearch('');
              setFilterType('todos');
            }}
            title="Buscar y abrir otro lote o deudor en una nueva pestaña"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid #0d9488',
              background: dropdownOpen ? '#0f766e' : '#0d9488',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: 4,
              transition: 'all 0.15s',
              boxShadow: '0 1px 3px rgba(13, 148, 136, 0.25)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0f766e';
            }}
            onMouseLeave={(e) => {
              if (!dropdownOpen) {
                e.currentTarget.style.background = '#0d9488';
              }
            }}
          >
            <Plus size={14} strokeWidth={2.8} />
            <span>Buscar otro Lote</span>
          </button>

          {/* Menú desplegable buscador interactivo de lotes */}
          {dropdownOpen && (
            <div
              ref={dropdownRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 6,
                width: 380,
                maxHeight: 460,
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: 10,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                padding: '12px 0 6px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
              }}
            >
              {/* Encabezado buscador */}
              <div style={{ padding: '0 14px 10px 14px', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Home size={15} color="#0f766e" />
                  <span>Abrir Lote en Nueva Pestaña</span>
                </div>
                
                {/* Input con icono de lupa */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    placeholder="Lote, manzana, cliente o cédula..."
                    style={{
                      width: '100%',
                      padding: '7px 28px 7px 32px',
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      fontSize: 12.5,
                      outline: 'none',
                      background: 'var(--bg-base, #f8fafc)',
                      color: 'var(--text-primary, #0f172a)',
                    }}
                  />
                  {dropdownSearch && (
                    <button
                      type="button"
                      onClick={() => setDropdownSearch('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        padding: 0,
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filtros rápidos: Todos, En Mora, Críticos, Al Día */}
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'mora', label: '🔴 En Mora' },
                    { id: 'criticos', label: '🚨 Críticos' },
                    { id: 'aldia', label: '🔵 Al Día' },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterType(f.id)}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: filterType === f.id ? '1px solid #0f766e' : '1px solid #e2e8f0',
                        background: filterType === f.id ? '#ccfbf1' : '#f8fafc',
                        color: filterType === f.id ? '#0f766e' : '#64748b',
                        fontWeight: filterType === f.id ? 800 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista scrolleable de lotes */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0', maxHeight: 300 }}>
                {filteredLotesDropdown.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                    No se encontraron contratos con "{dropdownSearch}"
                  </div>
                ) : (
                  filteredLotesDropdown.map((v) => {
                    const targetId = v.id || v.venta_id;
                    const isOpen = openLoteIds.includes(targetId);
                    const lStr = v.id_lote || v.lotes?.id_lote || 'Lote';
                    const cStr = v.cliente_nombre || v.clientes?.nombre || 'Cliente';
                    const docStr = v.clientes?.doc_cliente || '';
                    const cuotasVenc = Number(v.cuotas_vencidas || 0);
                    const saldo = Number(v.saldo || 0);
                    const isMora = cuotasVenc > 0 || v.es_critico;
                    const isSaldado = saldo <= 0 || v.estado === 'PAGADO EN SU TOTALIDAD' || v.estado === 'PAGADO';

                    return (
                      <div
                        key={targetId}
                        onClick={() => {
                          onOpenLote(v);
                          setDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          cursor: 'pointer',
                          background: isOpen ? '#f0fdf4' : 'transparent',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isOpen ? '#dcfce7' : '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isOpen ? '#f0fdf4' : 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', paddingRight: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f766e' }}>
                              {lStr}
                            </span>
                            {isMora ? (
                              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 800 }}>
                                🔴 {cuotasVenc} Mora
                              </span>
                            ) : isSaldado ? (
                              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#dcfce7', color: '#15803d', fontWeight: 800 }}>
                                🟢 Saldado
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', fontWeight: 800 }}>
                                🔵 Al Día
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cStr}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {docStr && `CC: ${docStr} · `}Saldo: <strong style={{ color: isMora ? '#dc2626' : '#0f766e' }}>{formatCOP(saldo)}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {isOpen ? (
                            <span style={{
                              fontSize: 10.5,
                              color: '#15803d',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              background: '#dcfce7',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}>
                              <Check size={11} /> Abierto
                            </span>
                          ) : (
                            <ChevronRight size={14} color="#94a3b8" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* CONTROLES MULTI-CLIENTE & CERRAR PESTAÑAS (CUANDO HAY MÁS DE 1 LOTE ABIERTO) */}
        {openLoteIds.length > 1 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
            {/* Selector de Modo de Visualización: 1 Cliente | Dividir 2 | Mosaico */}
            {onChangeViewMode && (
              <div style={{
                display: 'inline-flex',
                background: '#e2e8f0',
                padding: '2px',
                borderRadius: 6,
                border: '1px solid #cbd5e1'
              }}>
                <button
                  type="button"
                  onClick={() => onChangeViewMode('tabs')}
                  title="Ver 1 cliente en pestaña completa enfocada"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: viewMode === 'tabs' ? 800 : 600,
                    border: 'none',
                    background: viewMode === 'tabs' ? '#ffffff' : 'transparent',
                    color: viewMode === 'tabs' ? '#0f766e' : '#475569',
                    boxShadow: viewMode === 'tabs' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
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
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: viewMode === 'split2' ? 800 : 600,
                    border: 'none',
                    background: viewMode === 'split2' ? '#ffffff' : 'transparent',
                    color: viewMode === 'split2' ? '#0f766e' : '#475569',
                    boxShadow: viewMode === 'split2' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
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
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: viewMode === 'grid' ? 800 : 600,
                    border: 'none',
                    background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                    color: viewMode === 'grid' ? '#0f766e' : '#475569',
                    boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
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
                padding: '3px 8px',
                borderRadius: 5,
                border: '1px solid #fecaca',
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
              <XCircle size={12} />
              <span>Cerrar pestañas ({openLoteIds.length})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
