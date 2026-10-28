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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
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
      const activeEl = tabsContainerRef.current.querySelector('.chrome-tab-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId]);

  // Lista de asesores para el dropdown buscador
  const filteredAsesoresDropdown = asesores.filter(a => {
    const s = dropdownSearch.toLowerCase().trim();
    return !s || a.nombre.toLowerCase().includes(s);
  });

  return (
    <div style={{ position: 'relative', marginBottom: 20, zIndex: 10 }}>
      {/* Contenedor principal de pestañas estilo Chrome */}
      <div
        ref={tabsContainerRef}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          background: 'var(--bg-card2)',
          padding: '8px 8px 0 8px',
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          border: '1px solid var(--border)',
          borderBottom: '2px solid var(--accent)',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          gap: 3,
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
            fontWeight: activeTabId === 'general' ? 700 : 500,
            color: activeTabId === 'general' ? 'var(--text-primary)' : 'var(--text-secondary)',
            background: activeTabId === 'general' ? 'var(--bg-card)' : 'transparent',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            border: activeTabId === 'general' ? '1px solid var(--border)' : '1px solid transparent',
            borderBottom: activeTabId === 'general' ? '2px solid var(--bg-card)' : 'none',
            marginBottom: activeTabId === 'general' ? -2 : 0,
            boxShadow: activeTabId === 'general' ? '0 -2px 6px rgba(0,0,0,0.05)' : 'none',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            transition: 'background 0.15s, color 0.15s',
            zIndex: activeTabId === 'general' ? 2 : 1,
            flexShrink: 0,
          }}
        >
          <LayoutDashboard size={15} color={activeTabId === 'general' ? 'var(--accent)' : 'var(--text-muted)'} />
          <span>Balance General & Historial</span>
          <span style={{
            fontSize: 11,
            padding: '1px 6px',
            borderRadius: 10,
            background: activeTabId === 'general' ? 'var(--accent-soft)' : 'var(--bg-secondary)',
            color: activeTabId === 'general' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 700,
          }}>
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
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                borderBottom: isActive ? '2px solid var(--bg-card)' : 'none',
                marginBottom: isActive ? -2 : 0,
                boxShadow: isActive ? '0 -2px 6px rgba(0,0,0,0.05)' : 'none',
                maxWidth: 220,
                whiteSpace: 'nowrap',
                userSelect: 'none',
                transition: 'background 0.15s, color 0.15s',
                zIndex: isActive ? 2 : 1,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {/* Avatar circular con inicial */}
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: isActive ? 'var(--accent)' : 'var(--border-light)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {nombre.charAt(0).toUpperCase()}
              </div>

              {/* Nombre recortado si es largo */}
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 120,
              }}>
                {nombre}
              </span>

              {/* Badge sutil de saldo o ventas */}
              {saldoPendiente > 0 ? (
                <span style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: '#fef3c7',
                  color: '#92400e',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  Pend.
                </span>
              ) : (
                <span style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: '#dcfce7',
                  color: '#166534',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
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
                  color: 'var(--text-muted)',
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
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}

        {/* BOTÓN NUEVA PESTAÑA '+' (ESTILO CHROME) */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', paddingBottom: 6 }}>
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setDropdownSearch('');
            }}
            title="Abrir ficha de asesor en una nueva pestaña"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: dropdownOpen ? 'var(--accent-soft)' : 'var(--bg-card)',
              color: dropdownOpen ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              marginLeft: 4,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!dropdownOpen) {
                e.currentTarget.style.background = 'var(--accent-soft)';
                e.currentTarget.style.color = 'var(--accent)';
              }
            }}
            onMouseLeave={(e) => {
              if (!dropdownOpen) {
                e.currentTarget.style.background = 'var(--bg-card)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>

          {/* Menú desplegable para seleccionar asesor a abrir */}
          {dropdownOpen && (
            <div
              ref={dropdownRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 6,
                width: 320,
                maxHeight: 400,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-lg)',
                padding: '10px 0',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
              }}
            >
              {/* Encabezado del menú */}
              <div style={{
                padding: '4px 14px 10px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} color="var(--accent)" />
                  <span>Abrir Asesor en Pestaña</span>
                </div>
                {openAdvisorNames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onCloseAll?.();
                      setDropdownOpen(false);
                    }}
                    style={{
                      fontSize: 11,
                      color: '#dc2626',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Cerrar todas ({openAdvisorNames.length})
                  </button>
                )}
              </div>

              {/* Buscador de asesores */}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="form-input"
                    placeholder="Buscar asesor..."
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: 28,
                      paddingTop: 5,
                      paddingBottom: 5,
                      fontSize: 12,
                      height: 32,
                    }}
                  />
                  {dropdownSearch && (
                    <button
                      type="button"
                      onClick={() => setDropdownSearch('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista scrolleable de asesores */}
              <div style={{ overflowY: 'auto', maxHeight: 260, padding: '4px 6px' }}>
                {filteredAsesoresDropdown.length === 0 ? (
                  <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    No se encontró ningún comisionista con ese nombre.
                  </div>
                ) : (
                  filteredAsesoresDropdown.map((asesor) => {
                    const isOpen = openAdvisorNames.some(
                      n => n.toUpperCase() === asesor.nombre.toUpperCase()
                    );

                    return (
                      <div
                        key={asesor.nombre}
                        onClick={() => {
                          onOpenAdvisor(asesor.nombre);
                          setDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: isOpen ? 'var(--accent-soft)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isOpen) e.currentTarget.style.background = 'var(--bg-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isOpen) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: isOpen ? 'var(--accent)' : 'var(--bg-card2)',
                            border: '1px solid var(--border)',
                            color: isOpen ? '#ffffff' : 'var(--text-primary)',
                            fontSize: 11,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {asesor.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {asesor.nombre}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {asesor.totalVentas} ventas · Saldo: {formatCOP(asesor.saldoPendiente)}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {isOpen ? (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                            }}>
                              <Check size={12} /> Abierto
                            </span>
                          ) : (
                            <ChevronRight size={14} color="var(--text-muted)" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pie con atajo */}
              <div style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                fontSize: 11,
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                borderBottomLeftRadius: 10,
                borderBottomRightRadius: 10,
              }}>
                <span>💡 Tip: También puedes abrirlos desde la tabla general.</span>
              </div>
            </div>
          )}
        </div>

        {/* Atajo rápido a la derecha: Botón Cerrar Todas si hay más de 1 pestaña */}
        {openAdvisorNames.length > 1 && (
          <div style={{ marginLeft: 'auto', paddingBottom: 6 }}>
            <button
              type="button"
              onClick={onCloseAll}
              title="Cerrar todas las pestañas de asesores"
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = '#fca5a5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <XCircle size={12} />
              <span>Cerrar todas ({openAdvisorNames.length})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
