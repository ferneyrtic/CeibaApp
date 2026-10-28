import React, { useState, useRef, useEffect } from 'react';
import { 
  Users, User, Plus, X, Search, ChevronRight, Check,
  Briefcase, DollarSign, LayoutDashboard, Layers, XCircle
} from 'lucide-react';
import { formatCOP } from '../utils/helpers';

/**
 * Componente de barra de pestañas estilo Google Chrome para asesores comerciales.
 * Permite tener múltiples fichas de asesores abiertas simultáneamente,
 * alternar entre ellas, cerrarlas con "x", o abrir una nueva con el botón "+".
 */
export default function ChromeTabsBar({
  activeTabId,
  openAdvisorNames = [],
  asesores = [],
  onSelectTab,
  onCloseTab,
  onOpenAdvisor,
  onCloseAll,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const searchInputRef = useRef(null);
  const tabsContainerRef = useRef(null);

  // Cerrar modal al presionar Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && modalOpen) {
        setModalOpen(false);
      }
    }
    if (modalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalOpen]);

  // Desplazar automáticamente al tab activo cuando cambia
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeEl = tabsContainerRef.current.querySelector('.chrome-tab-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId]);

  // Lista de asesores para el buscador
  const filteredAsesores = asesores.filter(a => {
    const s = dropdownSearch.toLowerCase().trim();
    return !s || a.nombre.toLowerCase().includes(s);
  });

  return (
    <div style={{ position: 'relative', marginBottom: 20, zIndex: 10 }}>
      {/* Contenedor principal de pestañas estilo Chrome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#e2e8f0',
          borderRadius: '12px 12px 0 0',
          border: '1px solid #cbd5e1',
          borderBottom: '2px solid #16a34a',
          padding: '6px 8px 0 8px',
          gap: 6,
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        }}
      >
        {/* Strip con scroll horizontal para pestañas */}
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
          className="chrome-tabs-strip"
        >
          {/* PESTAÑA FIJA: BALANCE GENERAL / HISTORIAL */}
          <div
            onClick={() => onSelectTab('general')}
            className={activeTabId === 'general' ? 'chrome-tab-active' : 'chrome-tab-inactive'}
            title="Vista consolidada: Balance general y pagos de todos los comisionistas"
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
              borderTop: activeTabId === 'general' ? '3px solid #16a34a' : '3px solid transparent',
              borderLeft: activeTabId === 'general' ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
              borderRight: activeTabId === 'general' ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
              borderBottom: activeTabId === 'general' ? '2px solid #ffffff' : 'none',
              marginBottom: activeTabId === 'general' ? -2 : 0,
              boxShadow: activeTabId === 'general' ? '0 -2px 6px rgba(0,0,0,0.05)' : 'none',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'all 0.15s ease-in-out',
              zIndex: activeTabId === 'general' ? 3 : 1,
              flexShrink: 0,
            }}
          >
            <LayoutDashboard size={15} color={activeTabId === 'general' ? '#16a34a' : '#64748b'} />
            <span>Balance General & Historial</span>
            <span
              style={{
                fontSize: 11,
                padding: '1px 8px',
                borderRadius: 12,
                background: activeTabId === 'general' ? '#dcfce7' : '#e2e8f0',
                color: activeTabId === 'general' ? '#15803d' : '#475569',
                fontWeight: 800,
              }}
            >
              {asesores.length}
            </span>
          </div>

          {/* PESTAÑAS DINÁMICAS DE ASESORES ABIERTOS */}
          {openAdvisorNames.map((nombre) => {
            const isActive = activeTabId === nombre;
            const asesorInfo = asesores.find(a => a.nombre.toUpperCase() === nombre.toUpperCase());
            const totalVentas = asesorInfo?.totalVentas ?? 0;
            const saldoPendiente = asesorInfo?.saldoPendiente ?? 0;

            return (
              <div
                key={nombre}
                onClick={() => onSelectTab(nombre)}
                className={isActive ? 'chrome-tab-active' : 'chrome-tab-inactive'}
                title={`Ficha de ${nombre} · ${totalVentas} ventas · Saldo: ${formatCOP(saldoPendiente)}`}
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
                  borderTop: isActive ? '3px solid #16a34a' : '3px solid transparent',
                  borderLeft: isActive ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                  borderRight: isActive ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                  borderBottom: isActive ? '2px solid #ffffff' : 'none',
                  marginBottom: isActive ? -2 : 0,
                  boxShadow: isActive ? '0 -2px 6px rgba(0,0,0,0.05)' : 'none',
                  maxWidth: 240,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'all 0.15s ease-in-out',
                  zIndex: isActive ? 3 : 1,
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {/* Avatar circular con inicial */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: isActive ? '#16a34a' : '#cbd5e1',
                    color: isActive ? '#ffffff' : '#334155',
                    fontSize: 10.5,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {nombre.charAt(0).toUpperCase()}
                </div>

                {/* Nombre recortado */}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 120,
                    color: isActive ? '#0f172a' : '#334155',
                  }}
                >
                  {nombre}
                </span>

                {/* Badge de saldo o ventas */}
                {saldoPendiente > 0 ? (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #fde68a',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    Pend.
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #86efac',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {totalVentas}v
                  </span>
                )}

                {/* Botón de cerrar pestaña '×' */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(nombre, e);
                  }}
                  title={`Cerrar pestaña de ${nombre}`}
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

          {/* BOTÓN NUEVA PESTAÑA: '+ Buscar Asesor' */}
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 5, paddingLeft: 4 }}>
            <button
              type="button"
              onClick={() => {
                setDropdownSearch('');
                setModalOpen(true);
              }}
              title="Abrir ficha de asesor en una nueva pestaña"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 29,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid #16a34a',
                background: '#16a34a',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: '0 1px 3px rgba(22, 163, 74, 0.3)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#15803d';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#16a34a';
              }}
            >
              <Plus size={14} strokeWidth={3} />
              <span>Buscar Asesor</span>
            </button>
          </div>
        </div>

        {/* ACCIÓN CERRAR TODAS LAS PESTAÑAS */}
        {openAdvisorNames.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 5, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onCloseAll}
              title="Cerrar todas las pestañas de asesores"
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
              <span>Cerrar pestañas ({openAdvisorNames.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL FLOTANTE / DIÁLOGO DE BÚSQUEDA DE ASESORES ── */}
      {modalOpen && (
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
          onClick={() => setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
            }}
          >
            {/* Header del buscador */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  <Users size={18} color="#16a34a" />
                  <span>Abrir Asesor en Nueva Pestaña</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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

              {/* Input con lupa */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={18} style={{ position: 'absolute', left: 14, color: '#16a34a' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={dropdownSearch}
                  onChange={(e) => setDropdownSearch(e.target.value)}
                  placeholder="Escribe el nombre del asesor comercial..."
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 44px',
                    borderRadius: 8,
                    border: '2px solid #16a34a',
                    fontSize: 14,
                    fontWeight: 500,
                    outline: 'none',
                    background: '#ffffff',
                    color: '#0f172a',
                    boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.15)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredAsesores.length > 0) {
                      onOpenAdvisor(filteredAsesores[0].nombre);
                      setModalOpen(false);
                    }
                  }}
                />
                {dropdownSearch && (
                  <button
                    type="button"
                    onClick={() => setDropdownSearch('')}
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
            </div>

            {/* Lista de resultados */}
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: 360, padding: '6px 0' }}>
              {filteredAsesores.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                  <Search size={32} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                    No se encontraron asesores con "{dropdownSearch}"
                  </div>
                </div>
              ) : (
                filteredAsesores.map((a) => {
                  const isOpen = openAdvisorNames.some(n => n.toUpperCase() === a.nombre.toUpperCase());
                  return (
                    <div
                      key={a.nombre}
                      onClick={() => {
                        onOpenAdvisor(a.nombre);
                        setModalOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '11px 20px',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: '#dcfce7',
                            color: '#15803d',
                            fontWeight: 800,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #86efac',
                          }}
                        >
                          {a.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                            {a.nombre}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {a.totalVentas} {a.totalVentas === 1 ? 'lote vendido' : 'lotes vendidos'} · Comisiones: {formatCOP(a.totalComision)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                              color: '#16a34a',
                              background: '#f0fdf4',
                              padding: '4px 9px',
                              borderRadius: 6,
                              border: '1px solid #dcfce7',
                            }}
                          >
                            <span>Abrir</span>
                            <ChevronRight size={14} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '9px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#64748b' }}>
              <span>Presiona <strong>Enter</strong> para abrir</span>
              <span><strong>Esc</strong> para cerrar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
